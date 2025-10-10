#!/bin/bash

# Development stop script for macOS
# Stops all services started by dev_start.sh

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS_DIR="$PROJECT_DIR/dev_logs"

echo "========================================="
echo "🛑 Stopping Sanbox Development Environment"
echo "========================================="

# Function to kill processes by pattern
kill_process() {
    local pattern="$1"
    local description="$2"
    
    if pgrep -f "$pattern" >/dev/null 2>&1; then
        echo "🛑 Stopping $description..."
        pkill -f "$pattern"
        sleep 2
        
        # Force kill if still running
        if pgrep -f "$pattern" >/dev/null 2>&1; then
            echo "⚠️  Force killing $description..."
            pkill -9 -f "$pattern"
        fi
        echo "✅ $description stopped"
    else
        echo "ℹ️  $description was not running"
    fi
}

# Stop Django development server
kill_process "manage.py runserver" "Django development server"

# Stop Celery worker
kill_process "celery.*worker" "Celery worker"

# Stop Celery beat
kill_process "celery.*beat" "Celery beat"

# Stop React development server (if running)
kill_process "react-scripts/scripts/start.js" "React development server"

# Stop Redis (optional - you may want to keep it running for other projects)
echo "🔍 Checking Redis..."
read -p "Do you want to stop Redis? (y/N): " stop_redis
if [[ $stop_redis =~ ^[Yy]$ ]]; then
    if command -v brew >/dev/null 2>&1; then
        echo "🛑 Stopping Redis..."
        brew services stop redis
        echo "✅ Redis stopped"
    else
        echo "⚠️  Homebrew not found, Redis may still be running"
    fi
else
    echo "ℹ️  Keeping Redis running"
fi

# Clean up any leftover Celery files
echo "🧹 Cleaning up temporary files..."
cd "$PROJECT_DIR/backend"
rm -f celerybeat-schedule*
rm -f celerybeat.pid

echo ""
echo "========================================="
echo "✅ Development environment stopped!"
echo "========================================="

# Show any remaining processes (for debugging)
remaining_processes=$(pgrep -f "(celery|manage.py|react-scripts|node.*frontend)" || true)
if [ -n "$remaining_processes" ]; then
    echo ""
    echo "⚠️  Some processes may still be running:"
    ps aux | grep -E "(celery|manage.py|react-scripts|node.*frontend)" | grep -v grep || true
    echo ""
    echo "If needed, you can force kill them with:"
    echo "   sudo pkill -9 -f celery"
    echo "   sudo pkill -9 -f manage.py"
    echo "   sudo pkill -9 -f react-scripts"
fi

echo ""
echo "📋 Log files are preserved in: $LOGS_DIR"
echo "🚀 To start again: ./dev_start.sh"
echo "========================================="