#!/bin/bash

echo "========================================="
echo "Emergency: Stop Stuck Import"
echo "========================================="

cd /var/www/sanbox/backend
source ../venv/bin/activate
export DJANGO_SETTINGS_MODULE=sanbox.settings_production

echo "📋 1. Finding stuck imports..."
python manage.py shell -c "
from importer.models import StorageImport
from celery.result import AsyncResult
from django.utils import timezone

running_imports = StorageImport.objects.filter(status='running')
print(f'Found {running_imports.count()} running imports')

for imp in running_imports:
    duration = timezone.now() - imp.started_at
    print(f'Import {imp.id}: {imp.customer.name} - Running for {duration}')
    
    # If running for more than 30 minutes, consider it stuck
    if duration.total_seconds() > 1800:  # 30 minutes
        print(f'  ⚠️  Import {imp.id} appears stuck (>30 minutes)')
        
        # Try to revoke the Celery task
        if imp.celery_task_id:
            try:
                result = AsyncResult(imp.celery_task_id)
                result.revoke(terminate=True)
                print(f'  🛑 Revoked Celery task {imp.celery_task_id}')
            except Exception as e:
                print(f'  ❌ Failed to revoke task: {e}')
        
        # Mark import as failed
        imp.status = 'failed'
        imp.error_message = 'Import stopped due to timeout (>30 minutes)'
        imp.completed_at = timezone.now()
        imp.save()
        print(f'  ✅ Marked import {imp.id} as failed')
    else:
        print(f'  ℹ️  Import {imp.id} still within normal time range')
"

echo ""
echo "📋 2. Restarting Celery workers..."
pm2 restart sanbox-celery-worker
pm2 restart sanbox-celery-beat

echo ""
echo "📋 3. Current status:"
pm2 status

echo ""
echo "========================================="
echo "Emergency stop complete"
echo "========================================="