#!/bin/bash
set -e

# Rollback script for Sanbox containers
# Quickly rollback to a previous version
# Usage: ./rollback.sh [version-tag]
#   ./rollback.sh v1.2.2
#   ./rollback.sh           # Interactive mode - lists versions

APP_DIR="/var/www/sanbox"
VERSION_TAG=$1

echo "========================================="
echo "🔄 Sanbox Container Rollback"
echo "========================================="

# Navigate to app directory
if [ ! -d "$APP_DIR" ]; then
    echo "❌ App directory not found: $APP_DIR"
    exit 1
fi

cd "$APP_DIR"

# Check if docker-compose exists
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ docker-compose.yml not found in $APP_DIR"
    exit 1
fi

# List available versions if no version specified
if [ -z "$VERSION_TAG" ]; then
    echo ""
    echo "📋 Available Sanbox versions (Docker images):"
    echo ""
    docker images sanbox-backend --format "table {{.Tag}}\t{{.CreatedAt}}\t{{.Size}}" | grep -v "TAG" | head -10
    echo ""
    read -p "Enter version to rollback to (e.g., v1.2.2): " VERSION_TAG

    if [ -z "$VERSION_TAG" ]; then
        echo "❌ No version specified"
        exit 1
    fi
fi

echo ""
echo "🎯 Target version: $VERSION_TAG"

# Check if images exist for this version
echo ""
echo "🔍 Checking if images exist for version $VERSION_TAG..."

if ! docker image inspect sanbox-backend:${VERSION_TAG} > /dev/null 2>&1; then
    echo "❌ Backend image not found: sanbox-backend:${VERSION_TAG}"
    echo ""
    echo "Available backend versions:"
    docker images sanbox-backend --format "{{.Tag}}" | grep -v "TAG" | head -10
    exit 1
fi

if ! docker image inspect sanbox-frontend:${VERSION_TAG} > /dev/null 2>&1; then
    echo "❌ Frontend image not found: sanbox-frontend:${VERSION_TAG}"
    exit 1
fi

if ! docker image inspect sanbox-nginx:${VERSION_TAG} > /dev/null 2>&1; then
    echo "❌ Nginx image not found: sanbox-nginx:${VERSION_TAG}"
    exit 1
fi

echo "✅ All images found for version $VERSION_TAG"

# Show current version
echo ""
echo "📊 Current Deployment:"
if [ -f "deployment-info.txt" ]; then
    cat deployment-info.txt | head -6
else
    echo "  No deployment info available"
fi

# Confirm rollback
echo ""
read -p "⚠️  Rollback to $VERSION_TAG? This will restart all containers. (y/N): " confirm_rollback
if [[ ! $confirm_rollback =~ ^[Yy]$ ]]; then
    echo "❌ Rollback cancelled"
    exit 0
fi

# Backup database (optional but recommended)
echo ""
read -p "Create database backup before rollback? (Y/n): " create_backup
if [[ ! $create_backup =~ ^[Nn]$ ]]; then
    echo "💾 Creating database backup..."
    BACKUP_FILE="backup_before_rollback_$(date +%Y%m%d_%H%M%S).sql"

    docker-compose exec -T postgres pg_dump -U ${POSTGRES_USER:-sanbox_user} ${POSTGRES_DB:-sanbox_db} > "$BACKUP_FILE" 2>/dev/null || {
        echo "⚠️  Backup failed, but continuing..."
    }

    if [ -f "$BACKUP_FILE" ]; then
        echo "✅ Database backed up to: $BACKUP_FILE"
    fi
fi

# Tag images as latest
echo ""
echo "🏷️  Tagging version $VERSION_TAG as latest..."
docker tag sanbox-backend:${VERSION_TAG} sanbox-backend:latest
docker tag sanbox-frontend:${VERSION_TAG} sanbox-frontend:latest
docker tag sanbox-nginx:${VERSION_TAG} sanbox-nginx:latest
echo "✅ Images tagged"

# Stop current containers
echo ""
echo "🛑 Stopping current containers..."
docker-compose down --timeout 30
echo "✅ Containers stopped"

# Start containers with rollback version
echo ""
echo "🚀 Starting containers with version $VERSION_TAG..."
docker-compose up -d

# Wait for services
echo ""
echo "⏳ Waiting for services to start..."
sleep 10

# Check service status
echo ""
echo "🔍 Checking service health..."
docker-compose ps

# Wait for database
echo ""
echo "⏳ Waiting for database..."
until docker-compose exec -T postgres pg_isready -U ${POSTGRES_USER:-sanbox_user} > /dev/null 2>&1; do
    echo "  Database is starting..."
    sleep 2
done
echo "✅ Database is ready"

# Run migrations (in case of schema changes)
echo ""
echo "🗄️  Running database migrations..."
docker-compose exec -T backend python manage.py migrate --noinput

# Health check
echo ""
echo "🏥 Performing health check..."
sleep 5
if docker-compose exec -T backend python manage.py check > /dev/null 2>&1; then
    echo "✅ Backend health check passed"
else
    echo "⚠️  Backend health check failed"
    echo ""
    echo "Recent logs:"
    docker-compose logs --tail=20 backend
    echo ""
    read -p "Continue anyway? (y/N): " continue_anyway
    if [[ ! $continue_anyway =~ ^[Yy]$ ]]; then
        echo ""
        echo "❌ Rollback failed - check logs with: docker-compose logs -f backend"
        exit 1
    fi
fi

# Display rollback summary
echo ""
echo "========================================="
echo "✅ Rollback Completed!"
echo "========================================="
echo ""
echo "📊 Rollback Details:"
echo "  Version: $VERSION_TAG"
echo "  Completed: $(date)"
echo ""
echo "🐳 Running Containers:"
docker-compose ps
echo ""
echo "📋 Container Images:"
docker-compose images
echo ""
echo "🌐 Service URLs:"
echo "  Application: http://$(hostname -I | awk '{print $1}')/"
echo "  Admin:       http://$(hostname -I | awk '{print $1}')/admin/"
echo ""
echo "📝 Monitor Application:"
echo "  View logs:           docker-compose logs -f"
echo "  View backend logs:   docker-compose logs -f backend"
echo "  Check status:        docker-compose ps"
echo ""
if [ -f "$BACKUP_FILE" ]; then
    echo "💾 Database Backup:"
    echo "  Location: $APP_DIR/$BACKUP_FILE"
    echo "  Restore: cat $BACKUP_FILE | docker-compose exec -T postgres psql -U \${POSTGRES_USER} \${POSTGRES_DB}"
    echo ""
fi
echo "========================================="

# Update deployment info
cat > "$APP_DIR/deployment-info.txt" <<EOF
Deployment Information
=====================
Version: $VERSION_TAG (ROLLBACK)
Rolled Back: $(date)
Rolled Back By: $(whoami)
Previous Version: See backup file if created

ROLLBACK DEPLOYMENT
This is a rollback to a previous version.
EOF

echo "💾 Deployment info updated"
echo ""
echo "🎉 Rollback to $VERSION_TAG complete!"
echo "========================================="

# Remind about monitoring
echo ""
echo "⚠️  IMPORTANT: Monitor the application closely for the next few minutes"
echo "   Use: docker-compose logs -f"
