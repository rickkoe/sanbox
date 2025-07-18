#!/bin/bash

echo "========================================="
echo "Import Debug Script"
echo "========================================="

cd /var/www/sanbox/backend
source ../venv/bin/activate
export DJANGO_SETTINGS_MODULE=sanbox.settings_production

echo "📋 1. Checking running imports..."
python manage.py shell -c "
from importer.models import StorageImport
from django.utils import timezone

running_imports = StorageImport.objects.filter(status='running')
print(f'Running imports: {running_imports.count()}')

for imp in running_imports:
    duration = timezone.now() - imp.started_at
    print(f'Import {imp.id}: {imp.customer.name}')
    print(f'  Status: {imp.status}')
    print(f'  Duration: {duration}')
    print(f'  Task ID: {imp.celery_task_id}')
    print(f'  Items imported: {imp.total_items_imported}')
    print(f'  Error: {imp.error_message}')
    print()
"

echo ""
echo "📋 2. Checking Celery task status..."
python manage.py shell -c "
from celery.result import AsyncResult
from importer.models import StorageImport

running_import = StorageImport.objects.filter(status='running').first()
if running_import and running_import.celery_task_id:
    result = AsyncResult(running_import.celery_task_id)
    print(f'Task ID: {running_import.celery_task_id}')
    print(f'Task State: {result.state}')
    if hasattr(result, 'info') and result.info:
        print(f'Task Info: {result.info}')
    if result.traceback:
        print(f'Task Traceback: {result.traceback}')
else:
    print('No running import with task ID found')
"

echo ""
echo "📋 3. Recent Celery worker log entries..."
echo "Last 20 lines from Celery worker log:"
tail -20 /var/www/sanbox/logs/celery-worker-combined.log

echo ""
echo "📋 4. Checking for API connectivity..."
python manage.py shell -c "
from customers.models import Customer
import requests

# Get first customer with credentials
customer = Customer.objects.filter(
    insights_api_key__isnull=False,
    insights_tenant__isnull=False
).exclude(
    insights_api_key='',
    insights_tenant=''
).first()

if customer:
    print(f'Testing with customer: {customer.name}')
    print(f'Tenant: {customer.insights_tenant}')
    print('API Key: ***configured***')
    
    # Test basic connectivity (you might need to adjust this URL)
    try:
        import time
        print('Testing API connectivity...')
        # Just test basic HTTP connectivity
        response = requests.get('https://httpbin.org/status/200', timeout=10)
        print(f'Basic HTTP test: {response.status_code}')
    except Exception as e:
        print(f'Network error: {e}')
else:
    print('No customer with credentials found')
"

echo ""
echo "========================================="
echo "Debug complete"
echo "========================================="