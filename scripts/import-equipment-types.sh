#!/bin/bash
#
# Import Equipment Types to Database
# This script loads equipment types from a JSON fixture file
# Works for both development and production environments.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
FIXTURE_FILE="${1:-$SCRIPT_DIR/fixtures/equipment_types_fixture.json}"

echo "================================================"
echo "Equipment Types Import Script"
echo "================================================"
echo ""

# Check if fixture file exists
if [ ! -f "$FIXTURE_FILE" ]; then
    echo "ERROR: Fixture file not found: $FIXTURE_FILE"
    echo ""
    echo "Usage: $0 [fixture_file]"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Use default: equipment_types_fixture.json"
    echo "  $0 /path/to/custom_fixture.json      # Use custom file"
    exit 1
fi

echo "Fixture file: $FIXTURE_FILE"
echo ""

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
    echo "⚠️  WARNING: You are about to import equipment types to PRODUCTION"
    echo ""
    read -p "Do you want to create a backup first? (recommended) [Y/n]: " backup_response

    if [[ ! "$backup_response" =~ ^[Nn]$ ]]; then
        BACKUP_FILE="$PROJECT_DIR/equipment_types_backup_$(date +%Y%m%d_%H%M%S).json"
        echo "Creating backup..."
        if [ "$COMPOSE_FILE" = "docker-compose.dev.yml" ]; then
            docker-compose -f docker-compose.dev.yml exec -T backend python manage.py dumpdata core.EquipmentType --indent 2 > "$BACKUP_FILE" 2>/dev/null || true
        else
            docker-compose exec -T backend python manage.py dumpdata core.EquipmentType --indent 2 > "$BACKUP_FILE" 2>/dev/null || true
        fi

        if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
            echo "✓ Backup saved to: $BACKUP_FILE"
        else
            echo "! No existing equipment types to backup (or backup failed)"
            rm -f "$BACKUP_FILE"
        fi
        echo ""
    fi

    read -p "Continue with import to PRODUCTION? [y/N]: " confirm_response
    if [[ ! "$confirm_response" =~ ^[Yy]$ ]]; then
        echo "Import cancelled."
        exit 0
    fi
fi

echo "Copying fixture to container..."
docker cp "$FIXTURE_FILE" "$CONTAINER_NAME:/app/equipment_types_fixture.json"

echo "Loading fixture into database..."
if [ "$COMPOSE_FILE" = "docker-compose.dev.yml" ]; then
    docker-compose -f docker-compose.dev.yml exec -T backend python manage.py loaddata /app/equipment_types_fixture.json
else
    docker-compose exec -T backend python manage.py loaddata /app/equipment_types_fixture.json
fi

echo ""
echo "✓ Import complete!"
echo ""

# Show summary
echo "Verification:"
echo "-------------"
if [ "$COMPOSE_FILE" = "docker-compose.dev.yml" ]; then
    docker-compose -f docker-compose.dev.yml exec -T backend python manage.py shell -c "
from core.models import EquipmentType
count = EquipmentType.objects.count()
print(f'Total equipment types in database: {count}')
print()
print('Equipment Types:')
for eq in EquipmentType.objects.all().order_by('category', 'display_order'):
    status = '✓' if eq.is_active else '✗'
    print(f'  {status} {eq.name} ({eq.category})')
"
else
    docker-compose exec -T backend python manage.py shell -c "
from core.models import EquipmentType
count = EquipmentType.objects.count()
print(f'Total equipment types in database: {count}')
print()
print('Equipment Types:')
for eq in EquipmentType.objects.all().order_by('category', 'display_order'):
    status = '✓' if eq.is_active else '✗'
    print(f'  {status} {eq.name} ({eq.category})')
"
fi

echo ""
echo "Done! Equipment types have been imported successfully."
echo ""
