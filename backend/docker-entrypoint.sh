#!/bin/bash
set -e

echo "Waiting for database to be ready..."
python << END
import sys
import time
import psycopg2
import os

max_attempts = 30
attempt = 0

while attempt < max_attempts:
    try:
        conn = psycopg2.connect(
            dbname=os.environ.get('POSTGRES_DB', 'sanbox_dev'),
            user=os.environ.get('POSTGRES_USER', 'sanbox_dev'),
            password=os.environ.get('POSTGRES_PASSWORD', 'sanbox_dev_password'),
            host=os.environ.get('POSTGRES_HOST', 'postgres'),
            port=os.environ.get('POSTGRES_PORT', '5432')
        )
        conn.close()
        print("Database is ready!")
        sys.exit(0)
    except psycopg2.OperationalError:
        attempt += 1
        print(f"Database not ready yet. Attempt {attempt}/{max_attempts}...")
        time.sleep(1)

print("Database is not available after maximum attempts!")
sys.exit(1)
END

echo "Running database migrations..."
python manage.py migrate --noinput

echo "Creating default superuser if needed..."
python manage.py create_default_superuser

echo "Setting up demo customer and membership..."
python manage.py setup_demo_data

echo "Collecting static files..."
python manage.py collectstatic --noinput || true

echo "Starting application..."
exec "$@"
