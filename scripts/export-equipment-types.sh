#!/bin/bash
#
# Export Equipment Types from Development Database
# This script exports equipment types to a JSON fixture file
# that can be loaded into production.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_FILE="$PROJECT_DIR/equipment_types_fixture.json"

echo "================================================"
echo "Equipment Types Export Script"
echo "================================================"
echo ""

# Check if dev containers are running
if ! docker-compose -f docker-compose.dev.yml ps backend | grep -q "Up"; then
    echo "ERROR: Development backend container is not running"
    echo "Please start the development environment first:"
    echo "  ./start"
    exit 1
fi

echo "Exporting equipment types from development database..."

# Export from database
docker-compose -f docker-compose.dev.yml exec -T backend python manage.py dumpdata \
    core.EquipmentType \
    --indent 2 \
    --output /app/equipment_types_export.json

# Copy to host
docker cp sanbox_dev_backend:/app/equipment_types_export.json "$OUTPUT_FILE"

echo ""
echo "✓ Export complete!"
echo ""
echo "Summary:"
echo "--------"

# Show summary
COUNT=$(docker-compose -f docker-compose.dev.yml exec -T backend python manage.py shell -c \
    "from core.models import EquipmentType; print(EquipmentType.objects.count())" | tail -1)

echo "Exported $COUNT equipment types to:"
echo "  $OUTPUT_FILE"
echo ""

# List the equipment types
echo "Equipment Types:"
docker-compose -f docker-compose.dev.yml exec -T backend python manage.py shell -c "
from core.models import EquipmentType
for eq in EquipmentType.objects.all().order_by('category', 'display_order'):
    print(f'  - {eq.name} ({eq.category})')
"

echo ""
echo "Next Steps:"
echo "1. Review the exported file:"
echo "     cat $OUTPUT_FILE"
echo ""
echo "2. Copy to production server:"
echo "     scp equipment_types_fixture.json user@production-server:/path/to/sanbox/"
echo ""
echo "3. Load on production:"
echo "     docker cp equipment_types_fixture.json sanbox_backend:/app/"
echo "     docker-compose exec backend python manage.py loaddata /app/equipment_types_fixture.json"
echo ""
