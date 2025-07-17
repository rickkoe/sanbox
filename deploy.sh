#!/bin/bash
set -e

APP_DIR="/var/www/sanbox"
BRANCH="main"

echo "========================================="
echo "Starting deployment at $(date)"
echo "========================================="

cd $APP_DIR

echo "🔍 Checking system requirements..."

# Check if Redis is installed and running
if ! command -v redis-cli &> /dev/null; then
    echo "❌ Redis is not installed. Installing Redis..."
    sudo dnf install redis -y
else
    echo "✅ Redis is installed"
fi

# Check if Redis is running
if ! systemctl is-active --quiet redis; then
    echo "⚠️  Redis is not running. Starting Redis..."
    sudo systemctl start redis
    sudo systemctl enable redis
else
    echo "✅ Redis is running"
fi

# Test Redis connection
if redis-cli ping &> /dev/null; then
    echo "✅ Redis connection test passed"
else
    echo "❌ Redis connection test failed"
    echo "Attempting to start Redis..."
    sudo systemctl restart redis
    sleep 2
    if redis-cli ping &> /dev/null; then
        echo "✅ Redis connection restored"
    else
        echo "❌ Redis connection still failing - manual intervention needed"
        exit 1
    fi
fi

echo "📥 Pulling latest changes from GitHub..."
git pull origin $BRANCH

echo "🔧 Updating backend..."
cd backend
source ../venv/bin/activate

# Set production settings for all Django commands
export DJANGO_SETTINGS_MODULE=sanbox.settings_production

echo "   Installing Python dependencies..."
pip install -r requirements.txt

echo "   Running database migrations..."
echo "     → Checking for new migrations..."
python manage.py makemigrations --dry-run

echo "     → Creating any missing migrations..."
python manage.py makemigrations

echo "     → Applying migrations..."
python manage.py migrate --verbosity=1

echo "     → Verifying importer tables exist..."
python manage.py shell -c "
from django.db import connection
try:
    with connection.cursor() as cursor:
        cursor.execute(\"SELECT COUNT(*) FROM importer_storageimport;\")
        print('✅ importer_storageimport table exists')
except Exception as e:
    print(f'❌ importer tables missing: {e}')
    print('Running importer-specific migration...')
" || python manage.py migrate importer --verbosity=2

echo "   Collecting static files..."
python manage.py collectstatic --noinput

echo "🎨 Building frontend..."
cd ../frontend

echo "   Installing Node dependencies..."
npm install --legacy-peer-deps

echo "   Building React app..."
npm run build

echo "🚀 Managing services..."
cd ..

echo "   Creating logs directory..."
mkdir -p logs

# Function to start or restart a PM2 service
restart_or_start() {
    local service_name=$1
    echo "   Managing $service_name..."
    
    if pm2 list | grep -q "$service_name"; then
        echo "     → Restarting existing $service_name"
        pm2 restart "$service_name" --update-env
    else
        echo "     → Starting new $service_name"
        pm2 start ecosystem.config.js --only "$service_name"
    fi
}

# Manage each service individually
restart_or_start "sanbox-django"
restart_or_start "sanbox-celery-worker"
restart_or_start "sanbox-celery-beat"

echo "   Reloading Nginx..."
sudo systemctl reload nginx

echo "✅ Deployment completed successfully!"
echo "========================================="
echo "Services status:"
pm2 status

echo ""
echo "🔍 System health check:"
echo -n "   Redis status: "
if redis-cli ping &> /dev/null; then
    echo "✅ Running"
else
    echo "❌ Not responding"
fi

echo -n "   Nginx status: "
if systemctl is-active --quiet nginx; then
    echo "✅ Running"
else
    echo "❌ Not running"
fi

echo -n "   PostgreSQL status: "
if systemctl is-active --quiet postgresql; then
    echo "✅ Running"
else
    echo "❌ Not running"
fi

echo ""
echo "🌐 Your app is available at:"
echo "   Frontend: http://$(hostname -I | awk '{print $1}')/"
echo "   Admin:    http://$(hostname -I | awk '{print $1}')/admin/"
echo ""
echo "📋 To check logs:"
echo "   Django logs:       pm2 logs sanbox-django"
echo "   Celery Worker:     pm2 logs sanbox-celery-worker"
echo "   Celery Beat:       pm2 logs sanbox-celery-beat"
echo "   Nginx logs:        sudo tail -f /var/log/nginx/error.log"
echo "   Redis logs:        sudo journalctl -u redis -f"
echo ""
echo "🔧 Celery management commands:"
echo "   Check worker status: pm2 status sanbox-celery-worker"
echo "   Restart worker:      pm2 restart sanbox-celery-worker"
echo "   Stop worker:         pm2 stop sanbox-celery-worker"
echo "   Start worker:        pm2 start sanbox-celery-worker"
echo "========================================="