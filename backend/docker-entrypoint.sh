#!/bin/bash
set -e

echo "Waiting for database to be ready..."
python << END
import sys
import time
import psycopg2
import os

# Database connection parameters
db_params = {
    'dbname': os.environ.get('POSTGRES_DB', 'sanbox_db'),
    'user': os.environ.get('POSTGRES_USER', 'sanbox_user'),
    'password': os.environ.get('POSTGRES_PASSWORD', 'sanbox_lab_password_2024'),
    'host': os.environ.get('POSTGRES_HOST', 'postgres'),
    'port': os.environ.get('POSTGRES_PORT', '5432')
}

print(f"Connecting to PostgreSQL:")
print(f"  Host: {db_params['host']}:{db_params['port']}")
print(f"  Database: {db_params['dbname']}")
print(f"  User: {db_params['user']}")

max_attempts = 60  # Increased from 30 to 60 seconds
attempt = 0

while attempt < max_attempts:
    try:
        conn = psycopg2.connect(**db_params)
        conn.close()
        print("✅ Database is ready!")
        sys.exit(0)
    except psycopg2.OperationalError as e:
        attempt += 1
        if attempt % 10 == 0:  # Print detailed error every 10 attempts
            print(f"Database not ready yet. Attempt {attempt}/{max_attempts}...")
            print(f"  Error: {e}")
        else:
            print(f"Database not ready yet. Attempt {attempt}/{max_attempts}...")
        time.sleep(1)

print("❌ Database is not available after maximum attempts!")
print(f"Final connection attempt with: {db_params['user']}@{db_params['host']}:{db_params['port']}/{db_params['dbname']}")
sys.exit(1)
END

echo "Creating database migrations..."
python manage.py makemigrations --noinput

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
