from django.core.management.base import BaseCommand
from core.models import EquipmentType


class Command(BaseCommand):
    help = 'Seed initial equipment types for worksheet generator'

    def handle(self, *args, **kwargs):
        self.stdout.write('Seeding equipment types...')

        equipment_types = [
            {
                "name": "SAN Switch - Cisco",
                "category": "network",
                "vendor": "Cisco",
                "icon_name": "FaNetworkWired",
                "display_order": 1,
                "fields_schema": [
                    {"name": "switch_name", "label": "Switch Name", "type": "text", "required": True},
                    {"name": "management_ip", "label": "Management IP", "type": "text", "required": True},
                    {"name": "site_address", "label": "Site Address", "type": "textarea", "required": False},
                    {"name": "serial_number", "label": "Serial Number", "type": "text", "required": False},
                    {"name": "model", "label": "Model", "type": "select", "required": False,
                     "options": ["MDS 9148", "MDS 9396", "MDS 9710", "MDS 9718"]},
                    {"name": "port_count", "label": "Port Count", "type": "number", "required": False},
                    {"name": "firmware_version", "label": "Firmware Version", "type": "text", "required": False}
                ]
            },
            {
                "name": "SAN Switch - Brocade",
                "category": "network",
                "vendor": "Brocade",
                "icon_name": "FaNetworkWired",
                "display_order": 2,
                "fields_schema": [
                    {"name": "switch_name", "label": "Switch Name", "type": "text", "required": True},
                    {"name": "management_ip", "label": "Management IP", "type": "text", "required": True},
                    {"name": "site_address", "label": "Site Address", "type": "textarea", "required": False},
                    {"name": "serial_number", "label": "Serial Number", "type": "text", "required": False},
                    {"name": "model", "label": "Model", "type": "select", "required": False,
                     "options": ["G620", "G630", "G720", "X6-4", "X7-4", "X7-8"]},
                    {"name": "port_count", "label": "Port Count", "type": "number", "required": False},
                    {"name": "firmware_version", "label": "Firmware Version", "type": "text", "required": False}
                ]
            },
            {
                "name": "IBM FlashSystem",
                "category": "storage",
                "vendor": "IBM",
                "icon_name": "FaHdd",
                "display_order": 3,
                "fields_schema": [
                    {"name": "system_name", "label": "System Name", "type": "text", "required": True},
                    {"name": "management_ip", "label": "Management IP", "type": "text", "required": True},
                    {"name": "site_address", "label": "Site Address", "type": "textarea", "required": False},
                    {"name": "serial_number", "label": "Serial Number", "type": "text", "required": False},
                    {"name": "model", "label": "Model", "type": "select", "required": False,
                     "options": ["5015", "5035", "5045", "5100", "5200", "7200", "9200", "9500"]},
                    {"name": "node_count", "label": "Node Count", "type": "select", "required": False,
                     "options": ["2", "4"]},
                    {"name": "total_capacity_tb", "label": "Total Capacity (TB)", "type": "number", "required": False},
                    {"name": "software_version", "label": "Software Version", "type": "text", "required": False}
                ]
            },
            {
                "name": "IBM DS8000",
                "category": "storage",
                "vendor": "IBM",
                "icon_name": "FaServer",
                "display_order": 4,
                "fields_schema": [
                    {"name": "system_name", "label": "System Name", "type": "text", "required": True},
                    {"name": "management_ip", "label": "Management IP", "type": "text", "required": True},
                    {"name": "site_address", "label": "Site Address", "type": "textarea", "required": False},
                    {"name": "serial_number", "label": "Serial Number", "type": "text", "required": False},
                    {"name": "model", "label": "Model", "type": "select", "required": False,
                     "options": ["DS8880", "DS8900F"]},
                    {"name": "frame_count", "label": "Frame Count", "type": "number", "required": False},
                    {"name": "total_capacity_tb", "label": "Total Capacity (TB)", "type": "number", "required": False},
                    {"name": "microcode_level", "label": "Microcode Level", "type": "text", "required": False}
                ]
            },
            {
                "name": "Server",
                "category": "compute",
                "vendor": None,
                "icon_name": "FaServer",
                "display_order": 5,
                "fields_schema": [
                    {"name": "server_name", "label": "Server Name", "type": "text", "required": True},
                    {"name": "management_ip", "label": "Management IP", "type": "text", "required": True},
                    {"name": "site_address", "label": "Site Address", "type": "textarea", "required": False},
                    {"name": "serial_number", "label": "Serial Number", "type": "text", "required": False},
                    {"name": "vendor", "label": "Vendor", "type": "select", "required": False,
                     "options": ["IBM", "Dell", "HP", "Lenovo", "Cisco"]},
                    {"name": "model", "label": "Model", "type": "text", "required": False},
                    {"name": "cpu", "label": "CPU", "type": "text", "required": False},
                    {"name": "memory_gb", "label": "Memory (GB)", "type": "number", "required": False},
                    {"name": "operating_system", "label": "Operating System", "type": "text", "required": False}
                ]
            }
        ]

        created_count = 0
        updated_count = 0

        for eq_data in equipment_types:
            eq_type, created = EquipmentType.objects.update_or_create(
                name=eq_data['name'],
                defaults=eq_data
            )
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'✓ Created: {eq_type.name}'))
            else:
                updated_count += 1
                self.stdout.write(self.style.WARNING(f'↻ Updated: {eq_type.name}'))

        self.stdout.write(self.style.SUCCESS(
            f'\nCompleted! Created {created_count}, Updated {updated_count}'
        ))
