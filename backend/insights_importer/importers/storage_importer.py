from django.utils import timezone
from django.db import transaction
from storage.models import Storage, Volume, Host
from storage.serializers import StorageSerializer, VolumeSerializer, HostSerializer
from customers.models import Customer
from ..models import ImportJob, ImportLog, ImportHistory, APICredentials
from ..api_client import StorageInsightsAPIClient
import logging
import hashlib
import json
import re

logger = logging.getLogger(__name__)


class StorageImporter:
    """Handles importing storage data from IBM Storage Insights"""
    
    def __init__(self, import_job: ImportJob):
        self.import_job = import_job
        self.api_client = StorageInsightsAPIClient(import_job.api_credentials)
        self.customer = None
        
    def run_import(self, customer_id: int = None, import_type: str = 'full'):
        """Main import orchestration method"""
        try:
            self.import_job.status = 'running'
            self.import_job.started_at = timezone.now()
            self.import_job.save()
            
            if customer_id:
                self.customer = Customer.objects.get(id=customer_id)
            
            self._log('info', f'Starting {import_type} import')
            
            if import_type in ['full', 'storage_only']:
                storage_results = self._import_storage_systems()
                
            if import_type in ['full', 'volumes_only']:
                volume_results = self._import_volumes()
                
            if import_type in ['full', 'hosts_only']:
                host_results = self._import_host_connections()
            
            self._finalize_import('completed')
            
        except Exception as e:
            self._log('error', f'Import failed: {str(e)}', {'exception': str(e)})
            self._finalize_import('failed')
            raise
    
    def _import_storage_systems(self):
        """Import storage systems from Storage Insights"""
        self._log('info', 'Fetching storage systems from API')
        
        # Get all storage systems via paginated API
        systems = self.api_client.paginate_all(self.api_client.get_storage_systems)
        
        if not systems:
            self._log('warning', 'No storage systems found')
            return {'imported': 0, 'updated': 0, 'errors': 0}
        
        self.import_job.total_items += len(systems)
        self.import_job.save()
        
        results = {'imported': 0, 'updated': 0, 'errors': 0}
        
        for system_data in systems:
            try:
                result = self._process_storage_system(system_data)
                results[result] += 1
                self.import_job.processed_items += 1
                
                if result != 'error':
                    self.import_job.success_count += 1
                else:
                    self.import_job.error_count += 1
                    
                self.import_job.save()
                
            except Exception as e:
                self._log('error', f'Failed to process storage system {system_data.get("name", "unknown")}', 
                         {'system_data': system_data, 'error': str(e)})
                results['errors'] += 1
                self.import_job.error_count += 1
                self.import_job.save()
        
        self._log('info', f'Storage systems import complete', results)
        return results
    
    def _process_storage_system(self, system_data):
        """Process individual storage system"""
        system_id = system_data.get('storage_system_id')
        system_name = system_data.get('name', 'Unknown')
        
        # Transform API data to your model format (using your existing logic)
        storage_payload = self._build_storage_payload(system_data)
        
        # Check if already exists
        existing_storage = None
        if self.customer:
            existing_storage = Storage.objects.filter(
                customer=self.customer, 
                name=storage_payload['name']
            ).first()
        else:
            existing_storage = Storage.objects.filter(
                storage_system_id=system_id
            ).first()
        
        # Use your existing serializer
        serializer = StorageSerializer(instance=existing_storage, data=storage_payload)
        
        if serializer.is_valid():
            with transaction.atomic():
                storage_obj = serializer.save()
                storage_obj.imported = timezone.now()
                storage_obj.save(update_fields=['imported'])
                
                # Update import history
                self._update_import_history('storage_systems', system_id, system_data, storage_obj.id)
                
                action = 'updated' if existing_storage else 'imported'
                self._log('info', f'Successfully {action} storage system: {system_name}',
                         {'storage_id': storage_obj.id, 'system_id': system_id})
                
                return action
        else:
            self._log('error', f'Invalid storage data for {system_name}', 
                     {'errors': serializer.errors, 'system_data': system_data})
            return 'error'
    
    def _build_storage_payload(self, system_data):
        """Transform Storage Insights data to your Storage model format"""
        # Use your existing transformation logic from the frontend
        storage_type = self._determine_storage_type(system_data.get('type', ''))
        
        return {
            'customer': self.customer.id if self.customer else None,
            'name': system_data.get('name', 'Unnamed Storage'),
            'storage_type': storage_type,
            'storage_system_id': system_data.get('storage_system_id'),
            'location': system_data.get('location'),
            'machine_type': self._extract_machine_type(system_data.get('type')),
            'model': system_data.get('model'),
            'serial_number': system_data.get('serial_number'),
            'firmware_level': system_data.get('firmware'),
            'primary_ip': self._extract_primary_ip(system_data.get('ip_address')),
            'secondary_ip': self._extract_secondary_ip(system_data.get('ip_address')),
            'uuid': system_data.get('storage_system_id'),
            # Add all your other fields...
            'written_capacity_limit_bytes': system_data.get('written_capacity_limit_bytes'),
            'unmapped_capacity_percent': system_data.get('unmapped_capacity_percent'),
            'last_successful_probe': system_data.get('last_successful_probe'),
            'provisioned_written_capacity_percent': system_data.get('provisioned_written_capacity_percent'),
            'capacity_savings_bytes': system_data.get('capacity_savings_bytes'),
            'raw_capacity_bytes': system_data.get('raw_capacity_bytes'),
            'provisioned_capacity_percent': system_data.get('provisioned_capacity_percent'),
            'mapped_capacity_percent': system_data.get('mapped_capacity_percent'),
            'available_written_capacity_bytes': system_data.get('available_written_capacity_bytes'),
            'mapped_capacity_bytes': system_data.get('mapped_capacity_bytes'),
            'probe_status': system_data.get('probe_status'),
            'available_volume_capacity_bytes': system_data.get('available_volume_capacity_bytes'),
            'capacity_savings_percent': system_data.get('capacity_savings_percent'),
            'overhead_capacity_bytes': system_data.get('overhead_capacity_bytes'),
            'customer_country_code': system_data.get('customer_country_code'),
            'events_status': system_data.get('events_status'),
            'unmapped_capacity_bytes': system_data.get('unmapped_capacity_bytes'),
            'last_successful_monitor': system_data.get('last_successful_monitor'),
            'remote_relationships_count': system_data.get('remote_relationships_count'),
            'condition': system_data.get('condition'),
            'customer_number': system_data.get('customer_number'),
            'capacity_bytes': system_data.get('capacity_bytes'),
            'used_written_capacity_percent': system_data.get('used_written_capacity_percent'),
            'pools_count': system_data.get('pools_count'),
            'pm_status': system_data.get('pm_status'),
            'shortfall_percent': system_data.get('shortfall_percent'),
            'used_written_capacity_bytes': system_data.get('used_written_capacity_bytes'),
            'available_system_capacity_bytes': system_data.get('available_system_capacity_bytes'),
            'used_capacity_bytes': system_data.get('used_capacity_bytes'),
            'volumes_count': system_data.get('volumes_count'),
            'deduplication_savings_percent': system_data.get('deduplication_savings_percent'),
            'data_collection': system_data.get('data_collection'),
            'available_capacity_bytes': system_data.get('available_capacity_bytes'),
            'used_capacity_percent': system_data.get('used_capacity_percent'),
            'disks_count': system_data.get('disks_count'),
            'unprotected_volumes_count': system_data.get('unprotected_volumes_count'),
            'provisioned_capacity_bytes': system_data.get('provisioned_capacity_bytes'),
            'available_system_capacity_percent': system_data.get('available_system_capacity_percent'),
            'deduplication_savings_bytes': system_data.get('deduplication_savings_bytes'),
            'vendor': system_data.get('vendor'),
            'recent_fill_rate': system_data.get('recent_fill_rate'),
            'recent_growth': system_data.get('recent_growth'),
            'time_zone': system_data.get('time_zone'),
            'fc_ports_count': system_data.get('fc_ports_count'),
            'staas_environment': system_data.get('staas_environment'),
            'element_manager_url': system_data.get('element_manager_url'),
            'probe_schedule': system_data.get('probe_schedule'),
            'acknowledged': system_data.get('acknowledged'),
            'safe_guarded_capacity_bytes': system_data.get('safe_guarded_capacity_bytes'),
            'read_cache_bytes': system_data.get('read_cache_bytes'),
            'write_cache_bytes': system_data.get('write_cache_bytes'),
            'compressed': system_data.get('compressed'),
            'callhome_system': system_data.get('callhome_system'),
            'ransomware_threat_detection': system_data.get('ransomware_threat_detection'),
            'threat_notification_recipients': system_data.get('threat_notification_recipients'),
            'current_power_usage_watts': system_data.get('current_power_usage_watts'),
            'system_temperature_celsius': system_data.get('system_temperature_celsius'),
            'system_temperature_Fahrenheit': system_data.get('system_temperature_Fahrenheit'),
            'power_efficiency': system_data.get('power_efficiency'),
            'co2_emission': system_data.get('co2_emission'),
            'safeguarded_virtual_capacity_bytes': system_data.get('safeguarded_virtual_capacity_bytes'),
            'safeguarded_used_capacity_percentage': system_data.get('safeguarded_used_capacity_percentage'),
            'data_collection_type': system_data.get('data_collection_type'),
            'data_reduction_savings_percent': system_data.get('data_reduction_savings_percent'),
            'data_reduction_savings_bytes': system_data.get('data_reduction_savings_bytes'),
            'data_reduction_ratio': system_data.get('data_reduction_ratio'),
            'total_compression_ratio': system_data.get('total_compression_ratio'),
            'host_connections_count': system_data.get('host_connections_count'),
            'drive_compression_savings_percent': system_data.get('drive_compression_savings_percent'),
            'remaining_unallocated_capacity_bytes': system_data.get('remaining_unallocated_capacity_bytes'),
            'pool_compression_savings_bytes': system_data.get('pool_compression_savings_bytes'),
            'compression_savings_bytes': system_data.get('compression_savings_bytes'),
            'compression_savings_percent': system_data.get('compression_savings_percent'),
            'ip_ports_count': system_data.get('ip_ports_count'),
            'overprovisioned_capacity_bytes': system_data.get('overprovisioned_capacity_bytes'),
            'unallocated_volume_capacity_bytes': system_data.get('unallocated_volume_capacity_bytes'),
            'managed_disks_count': system_data.get('managed_disks_count'),
            'drive_compression_savings_bytes': system_data.get('drive_compression_savings_bytes'),
            'pool_compression_savings_percent': system_data.get('pool_compression_savings_percent'),
            'drive_compression_ratio': system_data.get('drive_compression_ratio'),
            'pool_compression_ratio': system_data.get('pool_compression_ratio'),
            'topology': system_data.get('topology'),
            'cluster_id_alias': system_data.get('cluster_id_alias'),
            'snapshot_written_capacity_bytes': system_data.get('snapshot_written_capacity_bytes'),
            'snapshot_provisioned_capacity_bytes': system_data.get('snapshot_provisioned_capacity_bytes'),
            'total_savings_ratio': system_data.get('total_savings_ratio'),
            'volume_groups_count': system_data.get('volume_groups_count'),
        }
    
    def _import_volumes(self):
        """Import volumes for all storage systems"""
        self._log('info', 'Starting volumes import')
        
        # Get storage systems that have been imported
        storage_systems = Storage.objects.filter(
            customer=self.customer,
            storage_system_id__isnull=False
        ) if self.customer else Storage.objects.filter(storage_system_id__isnull=False)
        
        if not storage_systems.exists():
            self._log('warning', 'No storage systems found to import volumes for')
            return {'imported': 0, 'updated': 0, 'errors': 0}
        
        results = {'imported': 0, 'updated': 0, 'errors': 0}
        total_systems = storage_systems.count()
        
        for i, storage in enumerate(storage_systems, 1):
            self._log('info', f'Importing volumes for storage system {storage.name} ({i}/{total_systems})')
            
            try:
                system_results = self._import_volumes_for_system(storage)
                for key in results:
                    results[key] += system_results[key]
                    
                # Update progress
                self.import_job.processed_items += 1
                self.import_job.save()
                
            except Exception as e:
                self._log('error', f'Failed to import volumes for {storage.name}', {'error': str(e)})
                results['errors'] += 1
                self.import_job.error_count += 1
                self.import_job.save()
        
        self._log('info', f'Volumes import complete', results)
        return results

    def _import_volumes_for_system(self, storage):
        """Import volumes for a specific storage system"""
        system_id = storage.storage_system_id
        
        # Get all volumes for this storage system
        volumes = self.api_client.paginate_system_resources(
            self.api_client.get_volumes_for_system, 
            system_id=system_id
        )
        
        if not volumes:
            self._log('info', f'No volumes found for storage system {storage.name}')
            return {'imported': 0, 'updated': 0, 'errors': 0}
        
        results = {'imported': 0, 'updated': 0, 'errors': 0}
        self.import_job.total_items += len(volumes)
        self.import_job.save()
        
        for volume_data in volumes:
            try:
                result = self._process_volume(volume_data, storage)
                results[result] += 1
                
                if result != 'error':
                    self.import_job.success_count += 1
                else:
                    self.import_job.error_count += 1
                    
            except Exception as e:
                self._log('error', f'Failed to process volume {volume_data.get("name", "unknown")}', 
                        {'volume_data': volume_data, 'error': str(e)})
                results['errors'] += 1
                self.import_job.error_count += 1
        
        self.import_job.save()
        return results

    def _process_volume(self, volume_data, storage):
        """Process individual volume"""
        volume_id = volume_data.get('id') or volume_data.get('volume_id')
        volume_name = volume_data.get('name', 'Unknown Volume')
        
        # Generate unique_id for lookup
        unique_id = volume_data.get('unique_id') or f"{storage.storage_system_id}-{volume_id or volume_name}"
        
        # Transform API data to your Volume model format
        try:
            volume_payload = self._build_volume_payload(volume_data, storage)
        except Exception as e:
            self._log('error', f'Failed to build volume payload for {volume_name}', {'error': str(e)})
            return 'error'
        
        # Check if volume already exists using unique_id (which is unique in your model)
        existing_volume = Volume.objects.filter(unique_id=unique_id).first()
        
        try:
            # Use your existing VolumeSerializer
            serializer = VolumeSerializer(instance=existing_volume, data=volume_payload)
            
            if serializer.is_valid():
                with transaction.atomic():
                    volume_obj = serializer.save()
                    volume_obj.imported = timezone.now()
                    volume_obj.save(update_fields=['imported'])
                    
                    # Update import history
                    self._update_import_history('volumes', unique_id, volume_data, volume_obj.id)
                    
                    action = 'updated' if existing_volume else 'imported'
                    self._log('info', f'Successfully {action} volume: {volume_name}',
                            {'volume_id': volume_obj.id, 'unique_id': unique_id})
                    
                    return action
            else:
                self._log('error', f'Invalid volume data for {volume_name}', 
                        {'errors': serializer.errors, 'volume_data': volume_data})
                return 'error'
                
        except Exception as e:
            self._log('error', f'Exception processing volume {volume_name}', {'error': str(e)})
            return 'error'

    def _build_volume_payload(self, volume_data, storage):
        """Transform Storage Insights volume data to your Volume model format"""
        # Generate unique_id from volume data - this is required and unique
        unique_id = volume_data.get('unique_id') or f"{storage.storage_system_id}-{volume_data.get('id', volume_data.get('name', 'unknown'))}"
        
        return {
            'storage': storage.id,
            'name': volume_data.get('name', 'Unknown Volume'),
            'volume_id': volume_data.get('id') or volume_data.get('volume_id', ''),
            'unique_id': unique_id,
            
            # Capacity fields
            'capacity_bytes': volume_data.get('capacity_bytes') or volume_data.get('size_bytes'),
            'used_capacity_bytes': volume_data.get('used_capacity_bytes'),
            'used_capacity_percent': volume_data.get('used_capacity_percent'),
            'available_capacity_bytes': volume_data.get('available_capacity_bytes'),
            'written_capacity_bytes': volume_data.get('written_capacity_bytes'),
            'written_capacity_percent': volume_data.get('written_capacity_percent'),
            'reserved_volume_capacity_bytes': volume_data.get('reserved_volume_capacity_bytes'),
            
            # Tier distribution percentages
            'tier0_flash_capacity_percent': volume_data.get('tier0_flash_capacity_percent'),
            'tier1_flash_capacity_percent': volume_data.get('tier1_flash_capacity_percent'),
            'scm_capacity_percent': volume_data.get('scm_capacity_percent'),
            'enterprise_hdd_capacity_percent': volume_data.get('enterprise_hdd_capacity_percent'),
            'nearline_hdd_capacity_percent': volume_data.get('nearline_hdd_capacity_percent'),
            'tier_distribution_percent': volume_data.get('tier_distribution_percent'),
            
            # Tier distribution bytes
            'tier0_flash_capacity_bytes': volume_data.get('tier0_flash_capacity_bytes'),
            'tier1_flash_capacity_bytes': volume_data.get('tier1_flash_capacity_bytes'),
            'scm_capacity_bytes': volume_data.get('scm_capacity_bytes'),
            'enterprise_hdd_capacity_bytes': volume_data.get('enterprise_hdd_capacity_bytes'),
            'nearline_hdd_capacity_bytes': volume_data.get('nearline_hdd_capacity_bytes'),
            'scm_available_capacity_bytes': volume_data.get('scm_available_capacity_bytes'),
            
            # Safeguarded fields
            'safeguarded_virtual_capacity_bytes': volume_data.get('safeguarded_virtual_capacity_bytes'),
            'safeguarded_used_capacity_percentage': volume_data.get('safeguarded_used_capacity_percentage'),
            'safeguarded_allocation_capacity_bytes': volume_data.get('safeguarded_allocation_capacity_bytes'),
            'safeguarded': volume_data.get('safeguarded'),
            
            # Pool and system info
            'pool_name': volume_data.get('pool_name'),
            'pool_id': volume_data.get('pool_id'),
            'node': volume_data.get('node'),
            'io_group': volume_data.get('io_group'),
            'lss_lcu': volume_data.get('lss_lcu'),
            
            # Volume properties
            'volume_number': volume_data.get('volume_number'),
            'volser': volume_data.get('volser'),
            'format': volume_data.get('format'),
            'natural_key': volume_data.get('natural_key'),
            'block_size': volume_data.get('block_size'),
            'grain_size_bytes': volume_data.get('grain_size_bytes'),
            
            # Status and configuration
            'acknowledged': volume_data.get('acknowledged', False),
            'status_label': volume_data.get('status_label'),
            'raid_level': volume_data.get('raid_level'),
            'copy_id': volume_data.get('copy_id'),
            
            # Features and settings
            'compressed': volume_data.get('compressed', False),
            'compression_saving_percent': volume_data.get('compression_saving_percent'),
            'thin_provisioned': volume_data.get('thin_provisioned'),
            'encryption': volume_data.get('encryption'),
            'flashcopy': volume_data.get('flashcopy'),
            'auto_expand': volume_data.get('auto_expand', False),
            'easy_tier': volume_data.get('easy_tier'),
            'easy_tier_status': volume_data.get('easy_tier_status'),
            'formatted': volume_data.get('formatted'),
            'virtual_disk_type': volume_data.get('virtual_disk_type'),
            'fast_write_state': volume_data.get('fast_write_state'),
            'vdisk_mirror_copies': volume_data.get('vdisk_mirror_copies'),
            'vdisk_mirror_role': volume_data.get('vdisk_mirror_role'),
            'deduplicated': volume_data.get('deduplicated'),
            
            # Monitoring
            'shortfall_percent': volume_data.get('shortfall_percent'),
            'warning_level_percent': volume_data.get('warning_level_percent'),
            'last_data_collection': volume_data.get('last_data_collection'),
        }

    def _import_host_connections(self):
        """Import host connections for all storage systems"""
        self._log('info', 'Starting host connections import')
        
        storage_systems = Storage.objects.filter(
            customer=self.customer,
            storage_system_id__isnull=False
        ) if self.customer else Storage.objects.filter(storage_system_id__isnull=False)
        
        if not storage_systems.exists():
            self._log('warning', 'No storage systems found to import hosts for')
            return {'imported': 0, 'updated': 0, 'errors': 0}
        
        results = {'imported': 0, 'updated': 0, 'errors': 0}
        total_systems = storage_systems.count()
        
        for i, storage in enumerate(storage_systems, 1):
            self._log('info', f'Importing hosts for storage system {storage.name} ({i}/{total_systems})')
            
            try:
                system_results = self._import_hosts_for_system(storage)
                for key in results:
                    results[key] += system_results[key]
                    
                self.import_job.processed_items += 1
                self.import_job.save()
                
            except Exception as e:
                self._log('error', f'Failed to import hosts for {storage.name}', {'error': str(e)})
                results['errors'] += 1
                self.import_job.error_count += 1
                self.import_job.save()
        
        self._log('info', f'Host connections import complete', results)
        return results

    def _import_hosts_for_system(self, storage):
        """Import host connections for a specific storage system"""
        system_id = storage.storage_system_id
        
        # Get all host connections for this storage system
        hosts = self.api_client.paginate_system_resources(
            self.api_client.get_hosts_for_system,
            system_id=system_id
        )
        
        if not hosts:
            self._log('info', f'No host connections found for storage system {storage.name}')
            return {'imported': 0, 'updated': 0, 'errors': 0}
        
        results = {'imported': 0, 'updated': 0, 'errors': 0}
        self.import_job.total_items += len(hosts)
        self.import_job.save()
        
        for host_data in hosts:
            try:
                result = self._process_host(host_data, storage)
                results[result] += 1
                
                if result != 'error':
                    self.import_job.success_count += 1
                else:
                    self.import_job.error_count += 1
                    
            except Exception as e:
                self._log('error', f'Failed to process host {host_data.get("name", "unknown")}', 
                        {'host_data': host_data, 'error': str(e)})
                results['errors'] += 1
                self.import_job.error_count += 1
        
        self.import_job.save()
        return results

    def _process_host(self, host_data, storage):
        """Process individual host connection"""
        host_id = host_data.get('id') or host_data.get('host_id')
        host_name = host_data.get('name', 'Unknown Host')
        natural_key = host_data.get('natural_key') or host_id
        
        # Transform API data to your Host model format
        try:
            host_payload = self._build_host_payload(host_data, storage)
        except ValueError as e:
            self._log('error', f'Cannot process host {host_name}: {str(e)}')
            return 'error'
        except Exception as e:
            self._log('error', f'Failed to build host payload for {host_name}', {'error': str(e)})
            return 'error'
        
        # Check if host already exists - your Host model has unique_together = ['project', 'name']
        existing_host = None
        if host_payload.get('project') and host_name:
            existing_host = Host.objects.filter(
                project_id=host_payload['project'],
                name=host_name
            ).first()
        
        # Also check by natural_key if available
        if not existing_host and natural_key:
            existing_host = Host.objects.filter(
                storage=storage,
                natural_key=natural_key
            ).first()
        
        try:
            # Use your existing HostSerializer
            serializer = HostSerializer(instance=existing_host, data=host_payload)
            
            if serializer.is_valid():
                with transaction.atomic():
                    host_obj = serializer.save()
                    host_obj.imported = timezone.now()
                    host_obj.save(update_fields=['imported'])
                    
                    # Update import history
                    self._update_import_history('hosts', natural_key or host_id, host_data, host_obj.id)
                    
                    action = 'updated' if existing_host else 'imported'
                    self._log('info', f'Successfully {action} host: {host_name}',
                            {'host_id': host_obj.id, 'natural_key': natural_key})
                    
                    return action
            else:
                self._log('error', f'Invalid host data for {host_name}', 
                        {'errors': serializer.errors, 'host_data': host_data})
                return 'error'
                
        except Exception as e:
            self._log('error', f'Exception processing host {host_name}', {'error': str(e)})
            return 'error'

    def _build_host_payload(self, host_data, storage):
        """Transform Storage Insights host data to your Host model format"""
        # Note: Host model requires a project - you'll need to handle this
        # For now, we'll need to either:
        # 1. Get the customer's default project, or
        # 2. Create a default project for imports, or
        # 3. Skip hosts if no project is available
        
        # Get customer's first project or create a default one
        project = None
        if storage.customer:
            project = storage.customer.projects.first()
            if not project:
                # You might want to create a default project here
                from core.models import Project
                project, created = Project.objects.get_or_create(
                    name=f"Storage Insights Import - {storage.customer.name}",
                    defaults={'notes': 'Auto-created for Storage Insights host imports'}
                )
                storage.customer.projects.add(project)
        
        if not project:
            raise ValueError(f"No project available for host import - customer: {storage.customer}")
        
        # Convert WWPNs list to text field (your model uses TextField)
        wwpns_text = ""
        if host_data.get('wwpns'):
            if isinstance(host_data['wwpns'], list):
                wwpns_text = ",".join(host_data['wwpns'])
            else:
                wwpns_text = str(host_data['wwpns'])
        
        return {
            'project': project.id,
            'name': host_data.get('name', 'Unknown Host'),
            'storage': storage.id,  # Your Host model has storage FK
            
            # Storage Insights fields that match your model
            'acknowledged': host_data.get('acknowledged'),
            'wwpns': wwpns_text,
            'status': host_data.get('status'),
            'storage_system': host_data.get('storage_system') or storage.name,
            'associated_resource': host_data.get('associated_resource'),
            'host_type': host_data.get('host_type'),
            'vols_count': host_data.get('vols_count') or host_data.get('volumes_count'),
            'fc_ports_count': host_data.get('fc_ports_count'),
            'last_data_collection': host_data.get('last_data_collection'),
            'volume_group': host_data.get('volume_group'),
            'natural_key': host_data.get('natural_key') or host_data.get('id'),
        }
    
    def _determine_storage_type(self, type_string):
        """Determine storage type from API type field"""
        if type_string.startswith("FlashSystem") or type_string.startswith("flashsystem"):
            return "FlashSystem"
        elif type_string.startswith("DS"):
            return "DS8000"
        else:
            return "Unknown"
    
    def _extract_machine_type(self, type_string):
        """Extract machine type from type string"""
        if type_string:
            match = re.search(r'\d{4}$', type_string)
            return match.group(0) if match else None
        return None
    
    def _extract_primary_ip(self, ip_address):
        """Extract primary IP from comma-separated string"""
        if ip_address:
            return ip_address.split(",")[0].strip()
        return None
    
    def _extract_secondary_ip(self, ip_address):
        """Extract secondary IP from comma-separated string"""
        if ip_address and "," in ip_address:
            return ip_address.split(",")[1].strip()
        return None
    
    def _update_import_history(self, resource_type, resource_id, api_data, local_object_id):
        """Update import history for tracking changes"""
        checksum = hashlib.md5(json.dumps(api_data, sort_keys=True).encode()).hexdigest()
        
        history, created = ImportHistory.objects.update_or_create(
            resource_type=resource_type,
            resource_id=resource_id,
            defaults={
                'last_imported': timezone.now(),
                'checksum': checksum,
                'local_object_id': str(local_object_id)
            }
        )
    
    def _log(self, level, message, details=None):
        """Add log entry to import job"""
        ImportLog.objects.create(
            import_job=self.import_job,
            level=level,
            message=message,
            details=details or {}
        )
        
        # Also log to Django logger
        getattr(logger, level)(f"Import Job {self.import_job.job_id}: {message}")
    
    def _finalize_import(self, status):
        """Finalize import job"""
        self.import_job.status = status
        self.import_job.completed_at = timezone.now()
        
        # Create summary
        self.import_job.result_summary = {
            'total_processed': self.import_job.processed_items,
            'successful': self.import_job.success_count,
            'errors': self.import_job.error_count,
            'duration_seconds': (self.import_job.completed_at - self.import_job.started_at).total_seconds()
        }
        
        self.import_job.save()
        self._log('info', f'Import job {status}', self.import_job.result_summary)