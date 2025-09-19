#!/bin/bash

# Test script for Storage Insights importer
# Runs basic connectivity and functionality tests

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"

echo "========================================="
echo "🧪 Testing Storage Insights Importer"
echo "========================================="

# Function to test API endpoint
test_endpoint() {
    local endpoint="$1"
    local description="$2"
    local expected_status="$3"
    
    echo -n "🔗 Testing $description... "
    
    response=$(curl -s -w "%{http_code}" "http://localhost:8000$endpoint" -o /tmp/test_response.json)
    
    if [ "$response" = "$expected_status" ]; then
        echo "✅ OK ($response)"
        if [ -f /tmp/test_response.json ]; then
            local content=$(cat /tmp/test_response.json)
            if [ ${#content} -lt 200 ]; then
                echo "   Response: $content"
            else
                echo "   Response: $(echo "$content" | cut -c1-100)..."
            fi
        fi
    else
        echo "❌ Failed ($response)"
        if [ -f /tmp/test_response.json ]; then
            echo "   Error: $(cat /tmp/test_response.json)"
        fi
    fi
    
    rm -f /tmp/test_response.json
}

# Function to test Celery tasks
test_celery_tasks() {
    echo "🧪 Testing Celery task execution..."
    
    cd "$BACKEND_DIR"
    source venv/bin/activate
    
    python manage.py shell -c "
from importer.tasks import test_task
try:
    result = test_task.delay()
    print('✅ Test task queued successfully')
    print(f'   Task ID: {result.id}')
    
    # Wait a moment and check result
    import time
    time.sleep(2)
    
    if result.ready():
        task_result = result.get()
        print(f'   Result: {task_result}')
    else:
        print('   ⏳ Task still running (this is normal)')
    
except Exception as e:
    print(f'❌ Celery task failed: {e}')
"
}

# Function to check database tables
check_database() {
    echo "🗄️  Checking database tables..."
    
    cd "$BACKEND_DIR"
    source venv/bin/activate
    
    python manage.py shell -c "
from django.db import connection

tables_to_check = [
    'importer_storageimport',
    'importer_importlog', 
    'customers_customer',
    'storage_storage',
    'storage_volume',
    'storage_host'
]

with connection.cursor() as cursor:
    for table in tables_to_check:
        try:
            cursor.execute(f'SELECT COUNT(*) FROM {table};')
            count = cursor.fetchone()[0]
            print(f'✅ {table}: {count} records')
        except Exception as e:
            print(f'❌ {table}: Error - {e}')
"
}

# Check if services are running first
echo "🔍 Checking service status..."

if ! pgrep -f "manage.py runserver" >/dev/null 2>&1; then
    echo "❌ Django server is not running. Please run ./dev_start.sh first"
    exit 1
fi

if ! pgrep -f "celery.*worker" >/dev/null 2>&1; then
    echo "❌ Celery worker is not running. Please run ./dev_start.sh first"
    exit 1
fi

if ! redis-cli ping >/dev/null 2>&1; then
    echo "❌ Redis is not running. Please run ./dev_start.sh first"
    exit 1
fi

echo "✅ All required services are running"
echo ""

# Run tests
test_endpoint "/api/importer/history/" "Import History API" "200"
test_endpoint "/api/importer/credentials/" "Credentials API" "200"
test_endpoint "/admin/" "Admin Interface" "200"

echo ""
check_database

echo ""
test_celery_tasks

echo ""
echo "========================================="
echo "📋 Test Summary"
echo "========================================="
echo ""
echo "If all tests passed, your importer should be working!"
echo ""
echo "🔧 Next steps to test actual import:"
echo "   1. Create a superuser: cd backend && python manage.py createsuperuser"
echo "   2. Go to: http://localhost:8000/admin/"
echo "   3. Create a customer with Storage Insights credentials"
echo "   4. Test import at: http://localhost:3000/import/ibm-storage-insights"
echo ""
echo "📊 Monitor import progress:"
echo "   tail -f dev_logs/celery-worker.log"
echo "   tail -f dev_logs/django.log"
echo ""
echo "========================================="