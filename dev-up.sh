#!/bin/bash
set -e

# Start development environment script for Sanbox
# This script starts all services in development mode with hot-reload

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "========================================="
echo "🚀 Starting Sanbox Development Environment"
echo "========================================="

# Check if .env.dev exists
if [ ! -f .env.dev ]; then
    echo "⚠️  .env.dev not found. Creating from .env.example..."
    cp .env.example .env.dev
    echo "✅ Created .env.dev - please review and update as needed"
fi

# Create logs directory
mkdir -p dev_logs

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "🐳 Starting Docker containers..."
echo ""

# Build images if needed
echo "📦 Building/pulling images (this may take a few minutes on first run)..."
docker-compose -f docker-compose.dev.yml build

# Start services
echo ""
echo "🚀 Starting services..."
docker-compose -f docker-compose.dev.yml up -d

# Wait for services to be healthy
echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Check service health
echo ""
echo "🔍 Checking service status..."
docker-compose -f docker-compose.dev.yml ps

# Wait for database to be ready
echo ""
echo "⏳ Waiting for database to be ready..."
until docker-compose -f docker-compose.dev.yml exec -T postgres pg_isready -U sanbox_dev > /dev/null 2>&1; do
    echo "  Database is unavailable - waiting..."
    sleep 2
done
echo "✅ Database is ready!"

# Run migrations
echo ""
echo "🗄️  Running database migrations..."
docker-compose -f docker-compose.dev.yml exec -T backend python manage.py migrate

# Create superuser if needed (optional)
echo ""
read -p "Do you want to create a Django superuser? (y/N): " create_superuser
if [[ $create_superuser =~ ^[Yy]$ ]]; then
    docker-compose -f docker-compose.dev.yml exec backend python manage.py createsuperuser
fi

echo ""
echo "========================================="
echo "🎉 Development environment is ready!"
echo "========================================="
echo ""
echo "📊 Services:"
echo "  ✅ PostgreSQL: localhost:5432"
echo "  ✅ Redis: localhost:6379"
echo "  ✅ Django Backend: http://localhost:8000"
echo "  ✅ Django Admin: http://localhost:8000/admin/"
echo "  ✅ React Frontend: http://localhost:3000"
echo "  ✅ Celery Worker: Running"
echo "  ✅ Celery Beat: Running"
echo ""
echo "📝 Quick Commands:"
echo "  View logs:           docker-compose -f docker-compose.dev.yml logs -f"
echo "  View backend logs:   docker-compose -f docker-compose.dev.yml logs -f backend"
echo "  View frontend logs:  docker-compose -f docker-compose.dev.yml logs -f frontend"
echo "  Django shell:        docker-compose -f docker-compose.dev.yml exec backend python manage.py shell"
echo "  Run migrations:      docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate"
echo "  Create migrations:   docker-compose -f docker-compose.dev.yml exec backend python manage.py makemigrations"
echo "  Frontend shell:      docker-compose -f docker-compose.dev.yml exec frontend sh"
echo "  Stop services:       ./dev-down.sh"
echo ""
echo "💡 Code changes will auto-reload!"
echo "   - Backend: Edit files in ./backend/"
echo "   - Frontend: Edit files in ./frontend/src/"
echo ""
echo "🛑 To stop all services:"
echo "   ./dev-down.sh"
echo "========================================="
