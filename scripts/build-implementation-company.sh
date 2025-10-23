#!/bin/bash
#
# Build Implementation Company Setup
# This script creates "Evolving Solutions" as the implementation company,
# adds contacts, and imports equipment types.
# Works for both development and production environments.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CONTACTS_FIXTURE="$SCRIPT_DIR/implementation_company_contacts.json"
EQUIPMENT_TYPES_FIXTURE="$PROJECT_DIR/equipment_types_fixture.json"

echo "================================================"
echo "Implementation Company Setup Script"
echo "================================================"
echo ""

# Check if contacts fixture file exists
if [ ! -f "$CONTACTS_FIXTURE" ]; then
    echo "ERROR: Contacts fixture file not found: $CONTACTS_FIXTURE"
    exit 1
fi

# Detect which environment (dev or production)
# Check for running containers directly
if docker ps --format '{{.Names}}' | grep -q "^sanbox_dev_backend$"; then
    COMPOSE_FILE="docker-compose.dev.yml"
    CONTAINER_NAME="sanbox_dev_backend"
    ENV_NAME="DEVELOPMENT"
elif docker ps --format '{{.Names}}' | grep -q "^sanbox_backend$"; then
    COMPOSE_FILE="docker-compose.yml"
    CONTAINER_NAME="sanbox_backend"
    ENV_NAME="PRODUCTION"
else
    echo "ERROR: No running backend container found"
    echo ""
    echo "Expected container names:"
    echo "  Development: sanbox_dev_backend"
    echo "  Production:  sanbox_backend"
    echo ""
    echo "Currently running containers:"
    docker ps --format '{{.Names}}' | grep "sanbox" || echo "  (no sanbox containers found)"
    echo ""
    echo "Please start either development or production environment first."
    exit 1
fi

echo "Environment: $ENV_NAME"
echo "Container: $CONTAINER_NAME"
echo ""

# Ask for confirmation in production
if [ "$ENV_NAME" = "PRODUCTION" ]; then
    echo "⚠️  WARNING: You are about to set up implementation company in PRODUCTION"
    echo ""
    echo "This will:"
    echo "  • Create/update 'Evolving Solutions' company (is_implementation_company=true)"
    echo "  • Add contacts from: $CONTACTS_FIXTURE"
    echo "  • Import equipment types"
    echo ""
    read -p "Continue with setup in PRODUCTION? [y/N]: " confirm_response
    if [[ ! "$confirm_response" =~ ^[Yy]$ ]]; then
        echo "Setup cancelled."
        exit 0
    fi
    echo ""
fi

# Step 1: Create/Update Evolving Solutions company
echo "Step 1: Creating/updating 'Evolving Solutions' company..."
echo "---------------------------------------------------"

if [ "$COMPOSE_FILE" = "docker-compose.dev.yml" ]; then
    docker-compose -f docker-compose.dev.yml exec -T backend python manage.py shell <<EOF
from customers.models import Customer

# Create or update Evolving Solutions
company, created = Customer.objects.get_or_create(
    name="Evolving Solutions",
    defaults={'is_implementation_company': True}
)

if not created:
    # Update existing company
    company.is_implementation_company = True
    company.save()
    print("✓ Updated existing 'Evolving Solutions' company")
else:
    print("✓ Created new 'Evolving Solutions' company")

print(f"  Company ID: {company.id}")
print(f"  Is Implementation Company: {company.is_implementation_company}")
EOF
else
    docker-compose exec -T backend python manage.py shell <<EOF
from customers.models import Customer

# Create or update Evolving Solutions
company, created = Customer.objects.get_or_create(
    name="Evolving Solutions",
    defaults={'is_implementation_company': True}
)

if not created:
    # Update existing company
    company.is_implementation_company = True
    company.save()
    print("✓ Updated existing 'Evolving Solutions' company")
else:
    print("✓ Created new 'Evolving Solutions' company")

print(f"  Company ID: {company.id}")
print(f"  Is Implementation Company: {company.is_implementation_company}")
EOF
fi

echo ""

# Step 2: Load contacts and link to company
echo "Step 2: Adding contacts to Evolving Solutions..."
echo "------------------------------------------------"

# First, load the contacts fixture (they have customer=null initially)
echo "Loading contacts from fixture..."
docker cp "$CONTACTS_FIXTURE" "$CONTAINER_NAME:/app/implementation_company_contacts.json"

if [ "$COMPOSE_FILE" = "docker-compose.dev.yml" ]; then
    docker-compose -f docker-compose.dev.yml exec -T backend python manage.py shell <<EOF
from customers.models import Customer, ContactInfo
import json

# Get Evolving Solutions company
company = Customer.objects.get(name="Evolving Solutions")

# Load contacts from fixture file
with open('/app/implementation_company_contacts.json', 'r') as f:
    contacts_data = json.load(f)

contacts_added = 0
contacts_skipped = 0

for contact_data in contacts_data:
    fields = contact_data['fields']
    email = fields['email']

    # Check if contact already exists
    if ContactInfo.objects.filter(email=email).exists():
        print(f"  ⊘ Skipped: {fields['name']} (already exists)")
        contacts_skipped += 1
        continue

    # Create new contact linked to Evolving Solutions
    contact = ContactInfo.objects.create(
        customer=company,
        name=fields['name'],
        email=fields['email'],
        phone_number=fields.get('phone_number', ''),
        title=fields.get('title', ''),
        is_default=fields.get('is_default', False),
        notes=fields.get('notes', '')
    )
    default_marker = ' (default)' if contact.is_default else ''
    print(f"  ✓ Added: {contact.name}{default_marker}")
    contacts_added += 1

print()
print(f"Summary: {contacts_added} contacts added, {contacts_skipped} skipped (already exist)")
EOF
else
    docker-compose exec -T backend python manage.py shell <<EOF
from customers.models import Customer, ContactInfo
import json

# Get Evolving Solutions company
company = Customer.objects.get(name="Evolving Solutions")

# Load contacts from fixture file
with open('/app/implementation_company_contacts.json', 'r') as f:
    contacts_data = json.load(f)

contacts_added = 0
contacts_skipped = 0

for contact_data in contacts_data:
    fields = contact_data['fields']
    email = fields['email']

    # Check if contact already exists
    if ContactInfo.objects.filter(email=email).exists():
        print(f"  ⊘ Skipped: {fields['name']} (already exists)")
        contacts_skipped += 1
        continue

    # Create new contact linked to Evolving Solutions
    contact = ContactInfo.objects.create(
        customer=company,
        name=fields['name'],
        email=fields['email'],
        phone_number=fields.get('phone_number', ''),
        title=fields.get('title', ''),
        is_default=fields.get('is_default', False),
        notes=fields.get('notes', '')
    )
    default_marker = ' (default)' if contact.is_default else ''
    print(f"  ✓ Added: {contact.name}{default_marker}")
    contacts_added += 1

print()
print(f"Summary: {contacts_added} contacts added, {contacts_skipped} skipped (already exist)")
EOF
fi

echo ""

# Step 3: Import equipment types
echo "Step 3: Importing equipment types..."
echo "------------------------------------"

if [ -f "$EQUIPMENT_TYPES_FIXTURE" ]; then
    # Call the import-equipment-types.sh script with auto-confirm
    if [ "$ENV_NAME" = "PRODUCTION" ]; then
        echo "n" | "$SCRIPT_DIR/import-equipment-types.sh" "$EQUIPMENT_TYPES_FIXTURE" 2>/dev/null || true
        echo "y" | "$SCRIPT_DIR/import-equipment-types.sh" "$EQUIPMENT_TYPES_FIXTURE"
    else
        "$SCRIPT_DIR/import-equipment-types.sh" "$EQUIPMENT_TYPES_FIXTURE"
    fi
else
    echo "⚠️  Equipment types fixture not found: $EQUIPMENT_TYPES_FIXTURE"
    echo "  Skipping equipment types import."
    echo "  You can run it manually later: ./scripts/import-equipment-types.sh"
fi

echo ""
echo "================================================"
echo "✓ Implementation Company Setup Complete!"
echo "================================================"
echo ""

# Final verification
echo "Verification:"
echo "-------------"

if [ "$COMPOSE_FILE" = "docker-compose.dev.yml" ]; then
    docker-compose -f docker-compose.dev.yml exec -T backend python manage.py shell <<EOF
from customers.models import Customer, ContactInfo
from core.models import EquipmentType

# Get company
company = Customer.objects.get(name="Evolving Solutions")
print(f"Company: {company.name}")
print(f"  Is Implementation Company: {company.is_implementation_company}")
print()

# Get contacts
contacts = ContactInfo.objects.filter(customer=company).order_by('-is_default', 'name')
print(f"Contacts ({contacts.count()}):")
for contact in contacts:
    default_marker = ' ⭐ DEFAULT' if contact.is_default else ''
    print(f"  • {contact.name}{default_marker}")
    print(f"    {contact.title}")
    print(f"    {contact.email} | {contact.phone_number}")
    print()

# Equipment types
eq_count = EquipmentType.objects.count()
print(f"Equipment Types: {eq_count} total")
EOF
else
    docker-compose exec -T backend python manage.py shell <<EOF
from customers.models import Customer, ContactInfo
from core.models import EquipmentType

# Get company
company = Customer.objects.get(name="Evolving Solutions")
print(f"Company: {company.name}")
print(f"  Is Implementation Company: {company.is_implementation_company}")
print()

# Get contacts
contacts = ContactInfo.objects.filter(customer=company).order_by('-is_default', 'name')
print(f"Contacts ({contacts.count()}):")
for contact in contacts:
    default_marker = ' ⭐ DEFAULT' if contact.is_default else ''
    print(f"  • {contact.name}{default_marker}")
    print(f"    {contact.title}")
    print(f"    {contact.email} | {contact.phone_number}")
    print()

# Equipment types
eq_count = EquipmentType.objects.count()
print(f"Equipment Types: {eq_count} total")
EOF
fi

echo ""
echo "Done! Your implementation company is ready for doc-builder."
echo ""
