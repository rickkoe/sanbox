#!/bin/bash

# Development status script for macOS
# Shows status of all development services

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS_DIR="$PROJECT_DIR/dev_logs"

echo "========================================="
echo "📊 Sanbox Development Environment Status"
echo "========================================="

# Function to check if a service is running
check_service() {
    local pattern="$1"
    local description="$2"
    local port="$3"
    
    if pgrep -f "$pattern" >/dev/null 2>&1; then
        local pid=$(pgrep -f "$pattern" | head -1)
        echo "✅ $description (PID: $pid)"
        
        # Test port if provided
        if [ -n "$port" ]; then
            if nc -z localhost "$port" 2>/dev/null; then
                echo "   🌐 Port $port: Available"
            else
                echo "   ⚠️  Port $port: Not responding"
            fi
        fi
    else
        echo "❌ $description: Not running"
    fi
}

# Function to test Redis connection
check_redis() {
    echo -n "🔴 Redis: "
    if command -v redis-cli >/dev/null 2>&1; then
        if redis-cli ping >/dev/null 2>&1; then
            echo "✅ Running and responding"
        else
            echo "❌ Installed but not responding"
        fi
    else
        echo "❌ Not installed"
    fi
}

# Function to test Celery worker
check_celery() {
    echo -n "👷 Celery Worker: "
    if pgrep -f "celery.*worker" >/dev/null 2>&1; then
        echo "✅ Running"
        
        # Test if worker is actually responding
        cd "$PROJECT_DIR/backend"
        if [ -d "venv" ]; then
            source venv/bin/activate
            python manage.py shell -c "
from celery import current_app
try:
    i = current_app.control.inspect()
    stats = i.stats()
    if stats:
        print('   🔄 Worker is responding to commands')
        for worker, data in stats.items():
            print(f'   📊 Active: {data.get(\"pool\", {}).get(\"processes\", \"?\")}, Total tasks: {data.get(\"total\", \"?\")}')
    else:
        print('   ⚠️  Worker not responding to inspect commands')
except Exception as e:
    print(f'   ❌ Worker connection failed: {e}')
" 2>/dev/null
        fi
    else
        echo "❌ Not running"
    fi
}

# Main status check
echo ""
check_redis
check_service "manage.py runserver" "Django Server" "8000"
check_celery
check_service "celery.*beat" "Celery Beat"
check_service "react-scripts start" "React Server" "3000"

echo ""
echo "📂 Log Files:"
if [ -d "$LOGS_DIR" ]; then
    for log_file in "$LOGS_DIR"/*.log; do
        if [ -f "$log_file" ]; then
            local filename=$(basename "$log_file")
            local size=$(du -h "$log_file" | cut -f1)
            local modified=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$log_file")
            echo "   📋 $filename ($size, modified: $modified)"
        fi
    done
else
    echo "   ℹ️  No log directory found"
fi

echo ""
echo "🌐 Service URLs:"
echo "   Backend API:     http://localhost:8000"
echo "   Admin Interface: http://localhost:8000/admin/"
echo "   Frontend:        http://localhost:3000"
echo "   Importer:        http://localhost:3000/import/ibm-storage-insights"

echo ""
echo "🔧 Quick Commands:"
echo "   View Django logs:     tail -f $LOGS_DIR/django.log"
echo "   View Celery logs:     tail -f $LOGS_DIR/celery-worker.log"
echo "   View Beat logs:       tail -f $LOGS_DIR/celery-beat.log"
echo "   Test import endpoint: curl http://localhost:8000/api/importer/history/"
echo "   Stop all services:    ./dev_stop.sh"
echo "   Restart services:     ./dev_stop.sh && ./dev_start.sh"

echo ""
echo "========================================="