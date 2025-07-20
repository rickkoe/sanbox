from django.utils import timezone
from storage.models import Storage, Volume
from .models import StorageImport
from .api_client import StorageInsightsClient
from typing import Dict, List


class SimpleStorageImporter:
    """Simple service for importing storage data from IBM Storage Insights"""
    
    def __init__(self, customer):
        self.customer = customer
        self.import_record = None
    
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
            use_mock_data = False  # Set to True for testing with mock data
            
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
            
            # Import data
            systems_imported = self._import_storage_systems(storage_systems, volumes_by_system)
            volumes_imported = self._import_volumes(storage_systems, volumes_by_system)
            hosts_imported = self._import_hosts(hosts_by_system)
            
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
            use_mock_data = False  # Set to True for testing with mock data
            
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
            
            # Import data
            if logger:
                logger.info("Starting storage systems import...")
            systems_imported = self._import_storage_systems(storage_systems, volumes_by_system)
            
            if logger:
                logger.info(f"Imported {systems_imported} storage systems, starting volumes import...")
            volumes_imported = self._import_volumes(storage_systems, volumes_by_system)
            
            if logger:
                logger.info(f"Imported {volumes_imported} volumes, starting hosts import...")
            hosts_imported = self._import_hosts(hosts_by_system)
            
            if logger:
                logger.info(f"Imported {hosts_imported} hosts, finalizing import...")
            
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
                
                # Map API fields to Storage model fields with correct field names
                defaults = {
                    'customer': self.customer,
                    'name': system_data.get('name', ''),
                    'storage_type': self._map_storage_type(system_data.get('type', '')),
                    'storage_system_id': system_id,
                    'model': system_data.get('model', ''),
                    'serial_number': system_data.get('serial_number', ''),  # Correct field name
                    'firmware_level': system_data.get('firmware', ''),      # Correct field name
                    'vendor': system_data.get('vendor', ''),
                    'location': system_data.get('location', ''),
                    'uuid': system_id,
                    'probe_status': system_data.get('probe_status', ''),
                    'condition': system_data.get('condition', ''),
                    # Add capacity and other fields as available
                    'raw_capacity_bytes': system_data.get('raw_capacity_bytes'),
                    'used_capacity_bytes': system_data.get('used_capacity_bytes'),
                    'available_capacity_bytes': system_data.get('available_capacity_bytes'),
                    'volumes_count': system_data.get('volumes_count'),
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
                {'id': 'host_1_1', 'name': 'TestHost01'},
                {'id': 'host_1_2', 'name': 'TestHost02'},
            ],
            'mock_system_2': [
                {'id': 'host_2_1', 'name': 'DSHost01'},
                {'id': 'host_2_2', 'name': 'DSHost02'},
                {'id': 'host_2_3', 'name': 'DSHost03'},
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
        """Import hosts - simplified approach"""
        imported_count = 0
        
        # For now, just count hosts - you can implement host import based on your models
        for system_id, hosts_data in hosts_by_system.items():
            imported_count += len(hosts_data)
        
        return imported_count
    
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