#!/bin/bash
set -e

# Development startup script for macOS
# Starts all services needed for Storage Insights importer testing

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
LOGS_DIR="$PROJECT_DIR/dev_logs"

echo "========================================="
echo "🚀 Starting Sanbox Development Environment"
echo "========================================="

# Create logs directory
mkdir -p "$LOGS_DIR"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a process is running
is_running() {
    pgrep -f "$1" >/dev/null 2>&1
}

# Function to start Redis
start_redis() {
    echo "🔍 Checking Redis..."
    
    if ! command_exists redis-server; then
        echo "❌ Redis not found. Installing via Homebrew..."
        if ! command_exists brew; then
            echo "❌ Homebrew not found. Please install Homebrew first:"
            echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            exit 1
        fi
        brew install redis
    fi
    
    # Check if Redis is already running
    if redis-cli ping >/dev/null 2>&1; then
        echo "✅ Redis is already running"
    else
        echo "🚀 Starting Redis..."
        brew services start redis
        
        # Wait for Redis to start
        echo "⏳ Waiting for Redis to start..."
        for i in {1..10}; do
            if redis-cli ping >/dev/null 2>&1; then
                echo "✅ Redis started successfully"
                break
            fi
            if [ $i -eq 10 ]; then
                echo "❌ Redis failed to start after 10 seconds"
                exit 1
            fi
            sleep 1
        done
    fi
}

# Function to setup Python virtual environment
setup_python_env() {
    echo "🐍 Setting up Python environment..."
    
    cd "$BACKEND_DIR"
    
    if [ ! -d "venv" ]; then
        echo "📦 Creating virtual environment..."
        python3 -m venv venv
    fi
    
    echo "🔧 Activating virtual environment..."
    source venv/bin/activate
    
    echo "📥 Installing Python dependencies..."
    pip install -r requirements.txt
    
    echo "🗄️  Running database migrations..."
    python manage.py migrate
    
    echo "✅ Python environment ready"
}

# Function to start Celery worker
start_celery_worker() {
    echo "👷 Starting Celery worker..."
    
    cd "$BACKEND_DIR"
    source venv/bin/activate
    
    # Kill any existing celery processes
    pkill -f "celery.*worker" || true
    
    # Start celery worker in background
    nohup python -m celery -A sanbox worker --loglevel=info \
        > "$LOGS_DIR/celery-worker.log" 2>&1 &
    
    echo "✅ Celery worker started (PID: $!)"
    echo "📋 Worker logs: $LOGS_DIR/celery-worker.log"
}

# Function to start Celery beat (scheduler)
start_celery_beat() {
    echo "⏰ Starting Celery beat..."
    
    cd "$BACKEND_DIR"
    source venv/bin/activate
    
    # Kill any existing celery beat processes
    pkill -f "celery.*beat" || true
    
    # Remove any existing beat schedule file
    rm -f celerybeat-schedule*
    
    # Start celery beat in background
    nohup python -m celery -A sanbox beat --loglevel=info \
        > "$LOGS_DIR/celery-beat.log" 2>&1 &
    
    echo "✅ Celery beat started (PID: $!)"
    echo "📋 Beat logs: $LOGS_DIR/celery-beat.log"
}

# Function to start Django development server
start_django() {
    echo "🌐 Starting Django development server..."
    
    cd "$BACKEND_DIR"
    source venv/bin/activate
    
    # Start Django in background
    nohup python manage.py runserver 0.0.0.0:8000 \
        > "$LOGS_DIR/django.log" 2>&1 &
    
    echo "✅ Django server started (PID: $!)"
    echo "📋 Django logs: $LOGS_DIR/django.log"
    echo "🌍 Backend available at: http://localhost:8000"
}

# Function to start React development server (optional)
start_react() {
    echo "⚛️  Starting React development server..."
    
    cd "$FRONTEND_DIR"
    
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing Node dependencies..."
        npm install --legacy-peer-deps
    fi
    
    # Start React in background
    nohup npm start > "$LOGS_DIR/react.log" 2>&1 &
    
    echo "✅ React server started (PID: $!)"
    echo "📋 React logs: $LOGS_DIR/react.log"
    echo "🌍 Frontend available at: http://localhost:3000"
}

# Function to test Celery connection
test_celery() {
    echo "🧪 Testing Celery connection..."
    
    cd "$BACKEND_DIR"
    source venv/bin/activate
    
    # Wait a moment for services to be ready
    sleep 3
    
    python manage.py shell -c "
from celery import current_app
try:
    i = current_app.control.inspect()
    stats = i.stats()
    if stats:
        print('✅ Celery worker is responding')
        for worker, data in stats.items():
            print(f'   Worker: {worker}')
    else:
        print('⚠️  No active Celery workers found')
except Exception as e:
    print(f'❌ Celery connection failed: {e}')
"
}

# Main execution
main() {
    # Start services
    start_redis
    setup_python_env
    start_celery_worker
    start_celery_beat
    start_django
    start_react

    # Test connections
    test_celery
    
    echo ""
    echo "========================================="
    echo "🎉 Development environment started!"
    echo "========================================="
    echo ""
    echo "📊 Services status:"
    echo "   ✅ Redis: Running"
    echo "   ✅ Django: http://localhost:8000"
    echo "   ✅ React: http://localhost:3000"
    echo "   ✅ Celery Worker: Running"
    echo "   ✅ Celery Beat: Running"
    echo ""
    echo "📋 Log files:"
    echo "   Django:        $LOGS_DIR/django.log"
    echo "   React:         $LOGS_DIR/react.log"
    echo "   Celery Worker: $LOGS_DIR/celery-worker.log"
    echo "   Celery Beat:   $LOGS_DIR/celery-beat.log"
    echo ""
    echo "🛑 To stop all services:"
    echo "   ./dev_stop.sh"
    echo ""
    echo "📊 To monitor logs:"
    echo "   tail -f $LOGS_DIR/django.log"
    echo "   tail -f $LOGS_DIR/react.log"
    echo "   tail -f $LOGS_DIR/celery-worker.log"
    echo "   tail -f $LOGS_DIR/celery-beat.log"
    echo ""
    echo "🧪 To test the importer:"
    echo "   1. Go to http://localhost:8000/admin/ (create superuser if needed)"
    echo "   2. Set up a customer with Storage Insights credentials"
    echo "   3. Go to the import page and test the import"
    echo "========================================="
}

# Run main function
main "$@"