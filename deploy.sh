#!/bin/bash
set -e

APP_DIR="/var/www/sanbox"
BRANCH="main"

echo "========================================="
echo "Starting deployment at $(date)"
echo "========================================="

cd $APP_DIR

echo "📥 Pulling latest changes from GitHub..."
git pull origin $BRANCH

echo "🔧 Updating backend..."
cd backend
source ../venv/bin/activate

echo "   Installing Python dependencies..."
pip install -r requirements.txt

echo "   Running database migrations..."
python manage.py migrate

echo "   Collecting static files..."
python manage.py collectstatic --noinput

echo "🎨 Building frontend..."
cd ../frontend

echo "   Installing Node dependencies..."
npm install --legacy-peer-deps

echo "   Building React app..."
npm run build

echo "🚀 Restarting services..."
cd ..

echo "   Creating logs directory..."
mkdir -p logs

echo "   Restarting Django..."
pm2 restart sanbox-django

echo "   Restarting Celery Worker..."
pm2 restart sanbox-celery-worker

echo "   Restarting Celery Beat..."
pm2 restart sanbox-celery-beat

echo "   Reloading Nginx..."
sudo systemctl reload nginx

echo "✅ Deployment completed successfully!"
echo "========================================="
echo "Services status:"
pm2 status

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
echo ""
echo "🔧 Celery management commands:"
echo "   Check worker status: pm2 status sanbox-celery-worker"
echo "   Restart worker:      pm2 restart sanbox-celery-worker"
echo "   Stop worker:         pm2 stop sanbox-celery-worker"
echo "   Start worker:        pm2 start sanbox-celery-worker"
echo "========================================="