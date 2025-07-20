#!/usr/bin/env python
"""
Emergency script to stop stuck imports on local development
"""
import os
import sys
import django
from datetime import timezone as tz

# Add the backend directory to Python path
backend_path = os.path.join(os.path.dirname(__file__), 'backend')
sys.path.insert(0, backend_path)

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sanbox.settings')
django.setup()

from importer.models import StorageImport
from celery.result import AsyncResult

def stop_running_imports():
    print("🔍 Finding running imports...")
    
    running_imports = StorageImport.objects.filter(status='running')
    print(f"Found {running_imports.count()} running imports")
    
    for imp in running_imports:
        print(f"\n📋 Import {imp.id}: {imp.customer.name}")
        print(f"   Started: {imp.started_at}")
        print(f"   Task ID: {imp.celery_task_id}")
        
        # Try to revoke the Celery task
        if imp.celery_task_id:
            try:
                result = AsyncResult(imp.celery_task_id)
                result.revoke(terminate=True)
                print(f"   🛑 Revoked Celery task")
            except Exception as e:
                print(f"   ⚠️  Failed to revoke task: {e}")
        
        # Mark import as failed
        imp.status = 'failed'
        imp.error_message = 'Import manually stopped by user'
        imp.completed_at = tz.now()
        imp.save()
        print(f"   ✅ Marked import as failed")
    
    if running_imports.count() == 0:
        print("✅ No running imports found")
    else:
        print(f"\n🎯 Stopped {running_imports.count()} imports")

if __name__ == "__main__":
    stop_running_imports()