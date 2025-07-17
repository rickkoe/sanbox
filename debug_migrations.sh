#!/bin/bash

echo "========================================="
echo "Django Migration Debug Script"
echo "========================================="

cd /var/www/sanbox/backend
source ../venv/bin/activate

echo "📋 1. Checking Django migration status..."
python manage.py showmigrations

echo ""
echo "📋 2. Checking specifically for importer app..."
python manage.py showmigrations importer

echo ""
echo "📋 3. Checking database tables that exist..."
python manage.py shell -c "
from django.db import connection
with connection.cursor() as cursor:
    cursor.execute(\"SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;\")
    tables = cursor.fetchall()
    print('Existing database tables:')
    for table in tables:
        if 'importer' in table[0].lower():
            print(f'  ✅ {table[0]}')
        else:
            print(f'     {table[0]}')
"

echo ""
echo "📋 4. Checking if importer app is in INSTALLED_APPS..."
python manage.py shell -c "
from django.conf import settings
apps = settings.INSTALLED_APPS
if 'importer' in apps:
    print('✅ importer app is in INSTALLED_APPS')
else:
    print('❌ importer app is NOT in INSTALLED_APPS')
print('All apps:', apps)
"

echo ""
echo "📋 5. Attempting to create missing migrations..."
python manage.py makemigrations importer

echo ""
echo "📋 6. Attempting to apply migrations..."
python manage.py migrate importer

echo ""
echo "========================================="
echo "Debug complete. Check output above."
echo "========================================="