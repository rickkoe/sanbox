#!/bin/bash

echo "========================================="
echo "Force Fix Importer Migrations"
echo "========================================="

cd /var/www/sanbox/backend
source ../venv/bin/activate

echo "📋 1. Removing any conflicting migration files..."
rm -f importer/migrations/000*.py

echo "📋 2. Creating fresh migrations for importer app..."
python manage.py makemigrations importer --empty --name initial_importer_setup

echo "📋 3. Creating migrations with model definitions..."
python manage.py makemigrations importer

echo "📋 4. Showing what migrations will be applied..."
python manage.py showmigrations importer

echo "📋 5. Applying migrations with verbose output..."
python manage.py migrate importer --verbosity=2

echo "📋 6. Verifying tables were created..."
python manage.py shell -c "
from django.db import connection
with connection.cursor() as cursor:
    cursor.execute(\"SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%importer%' ORDER BY tablename;\")
    tables = cursor.fetchall()
    print('Importer tables found:')
    for table in tables:
        print(f'  ✅ {table[0]}')
    if not tables:
        print('❌ No importer tables found!')
"

echo ""
echo "========================================="
echo "Migration fix complete!"
echo "========================================="