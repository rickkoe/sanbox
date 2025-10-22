#!/bin/bash
#
# Check Logo File in Production
# This script helps diagnose why the logo isn't appearing in production worksheets
#

set -e

echo "================================================"
echo "Logo File Production Diagnostic"
echo "================================================"
echo ""

# Detect environment
if docker ps --format '{{.Names}}' | grep -q "^sanbox_backend$"; then
    CONTAINER_NAME="sanbox_backend"
    ENV="PRODUCTION"
elif docker ps --format '{{.Names}}' | grep -q "^sanbox_dev_backend$"; then
    CONTAINER_NAME="sanbox_dev_backend"
    ENV="DEVELOPMENT"
else
    echo "ERROR: No backend container found"
    exit 1
fi

echo "Environment: $ENV"
echo "Container: $CONTAINER_NAME"
echo ""

# Check BASE_DIR
echo "1. Checking BASE_DIR setting..."
docker exec $CONTAINER_NAME python manage.py shell -c "
from django.conf import settings
print(f'BASE_DIR: {settings.BASE_DIR}')
print(f'STATIC_ROOT: {settings.STATIC_ROOT}')
print(f'STATIC_URL: {settings.STATIC_URL}')
"
echo ""

# Check logo path used in code
echo "2. Checking logo path used in worksheet generation..."
docker exec $CONTAINER_NAME python manage.py shell -c "
import os
from django.conf import settings
logo_path = os.path.join(settings.BASE_DIR, 'static', 'images', 'company-logo.png')
print(f'Logo path: {logo_path}')
print(f'Exists: {os.path.exists(logo_path)}')
if os.path.exists(logo_path):
    print(f'Size: {os.path.getsize(logo_path)} bytes')
"
echo ""

# Check common logo locations
echo "3. Checking common logo file locations..."
echo "   Searching for company-logo.png in container..."
docker exec $CONTAINER_NAME find /app -name "company-logo.png" 2>/dev/null || echo "   Not found in /app"
echo ""

# Check if static files are collected
echo "4. Checking STATIC_ROOT location..."
docker exec $CONTAINER_NAME ls -lh /var/www/sanbox/backend/static/images/company-logo.png 2>/dev/null || echo "   Not found in STATIC_ROOT"
echo ""

# Check /app/static location
echo "5. Checking /app/static location..."
docker exec $CONTAINER_NAME ls -lh /app/static/images/company-logo.png 2>/dev/null || echo "   Not found in /app/static"
echo ""

# Check backend/static location
echo "6. Checking /app/backend/static location..."
docker exec $CONTAINER_NAME ls -lh /app/backend/static/images/company-logo.png 2>/dev/null || echo "   Not found in /app/backend/static"
echo ""

echo "================================================"
echo "Recommendations:"
echo "================================================"
echo ""
echo "If logo file is missing, try:"
echo "1. Ensure logo exists in backend/static/images/ directory"
echo "2. Rebuild production container:"
echo "     docker-compose build backend"
echo "     docker-compose up -d backend"
echo ""
echo "3. Or manually copy logo to container:"
echo "     docker cp backend/static/images/company-logo.png $CONTAINER_NAME:/app/backend/static/images/"
echo ""
