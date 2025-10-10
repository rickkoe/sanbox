#!/bin/bash
set -e

# Remote deployment script - pulls pre-built images from registry
# Usage: ./deploy-container-remote.sh <version-tag> [registry]
#   ./deploy-container-remote.sh v1.2.3
#   ./deploy-container-remote.sh v1.2.3 ghcr.io/your-org/sanbox

VERSION_TAG=$1
REGISTRY=${2:-""}
APP_DIR="/var/www/sanbox"

if [ -z "$VERSION_TAG" ]; then
    echo "❌ Error: Version tag is required"
    echo "Usage: ./deploy-container-remote.sh <version-tag> [registry]"
    echo "Example: ./deploy-container-remote.sh v1.2.3"
    echo "Example: ./deploy-container-remote.sh v1.2.3 ghcr.io/your-org/sanbox"
    exit 1
fi

echo "========================================="
echo "🐳 Sanbox Remote Container Deployment"
echo "========================================="
echo "Version: $VERSION_TAG"
if [ ! -z "$REGISTRY" ]; then
    echo "Registry: $REGISTRY"
fi
echo "Started: $(date)"
echo "========================================="

# Check prerequisites
echo ""
echo "🔍 Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    exit 1
fi
echo "✅ Docker: $(docker --version)"

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed"
    exit 1
fi
echo "✅ Docker Compose: $(docker-compose --version)"

if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker daemon is not running"
    exit 1
fi
echo "✅ Docker daemon is running"

# Determine image names
if [ ! -z "$REGISTRY" ]; then
    BACKEND_IMAGE="${REGISTRY}/backend:${VERSION_TAG}"
    FRONTEND_IMAGE="${REGISTRY}/frontend:${VERSION_TAG}"
    NGINX_IMAGE="${REGISTRY}/nginx:${VERSION_TAG}"
else
    BACKEND_IMAGE="sanbox-backend:${VERSION_TAG}"
    FRONTEND_IMAGE="sanbox-frontend:${VERSION_TAG}"
    NGINX_IMAGE="sanbox-nginx:${VERSION_TAG}"
fi

echo ""
echo "📦 Target Images:"
echo "  Backend:  $BACKEND_IMAGE"
echo "  Frontend: $FRONTEND_IMAGE"
echo "  Nginx:    $NGINX_IMAGE"

# Pull images from registry
if [ ! -z "$REGISTRY" ]; then
    echo ""
    echo "📥 Pulling images from registry..."

    echo "  → Pulling backend..."
    docker pull $BACKEND_IMAGE

    echo "  → Pulling frontend..."
    docker pull $FRONTEND_IMAGE

    echo "  → Pulling nginx..."
    docker pull $NGINX_IMAGE

    # Tag as local images for docker-compose
    echo ""
    echo "🏷️  Tagging images for local use..."
    docker tag $BACKEND_IMAGE sanbox-backend:${VERSION_TAG}
    docker tag $BACKEND_IMAGE sanbox-backend:latest
    docker tag $FRONTEND_IMAGE sanbox-frontend:${VERSION_TAG}
    docker tag $FRONTEND_IMAGE sanbox-frontend:latest
    docker tag $NGINX_IMAGE sanbox-nginx:${VERSION_TAG}
    docker tag $NGINX_IMAGE sanbox-nginx:latest

    echo "✅ Images pulled and tagged"
else
    echo ""
    echo "ℹ️  No registry specified - using local images"

    # Check if images exist locally
    if ! docker image inspect sanbox-backend:${VERSION_TAG} > /dev/null 2>&1; then
        echo "❌ Image sanbox-backend:${VERSION_TAG} not found locally"
        echo "   Run build-and-push.sh first or specify a registry"
        exit 1
    fi
fi

# Ensure app directory exists
if [ ! -d "$APP_DIR" ]; then
    echo ""
    echo "📁 Creating app directory..."
    mkdir -p "$APP_DIR"
fi

# Create logs directory
mkdir -p "$APP_DIR/logs"

# Check for .env file
if [ ! -f "$APP_DIR/.env" ]; then
    echo ""
    echo "⚠️  WARNING: .env file not found!"
    echo "   Creating from example..."
    if [ -f ".env.example" ]; then
        cp .env.example "$APP_DIR/.env"
        echo "   Please update $APP_DIR/.env with production values before continuing!"
        read -p "   Press Enter when ready to continue..."
    else
        echo "   ❌ .env.example not found. Please create $APP_DIR/.env manually"
        exit 1
    fi
fi

# Copy docker-compose.yml if needed
if [ ! -f "$APP_DIR/docker-compose.yml" ] || [ "docker-compose.yml" -nt "$APP_DIR/docker-compose.yml" ]; then
    echo ""
    echo "📋 Updating docker-compose.yml..."
    cp docker-compose.yml "$APP_DIR/"
fi

# Navigate to app directory
cd "$APP_DIR"

# Stop existing containers
echo ""
echo "🛑 Stopping existing containers..."
if docker-compose ps -q | grep -q .; then
    echo "  → Gracefully stopping services..."
    docker-compose down --timeout 30
    echo "✅ Containers stopped"
else
    echo "  → No running containers found"
fi

# Start containers with new version
echo ""
echo "🚀 Starting containers (version: $VERSION_TAG)..."
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

# Run migrations
echo ""
echo "🗄️  Running database migrations..."
docker-compose exec -T backend python manage.py migrate --noinput

# Collect static files
echo ""
echo "📦 Collecting static files..."
docker-compose exec -T backend python manage.py collectstatic --noinput || true

# Health check
echo ""
echo "🏥 Performing health check..."
sleep 5
if docker-compose exec -T backend python manage.py check --deploy > /dev/null 2>&1; then
    echo "✅ Backend health check passed"
else
    echo "⚠️  Backend health check failed - check logs"
fi

# Display deployment summary
echo ""
echo "========================================="
echo "✅ Deployment Completed!"
echo "========================================="
echo ""
echo "📊 Deployment Details:"
echo "  Version: $VERSION_TAG"
echo "  Deployed: $(date)"
echo "  Registry: ${REGISTRY:-Local images}"
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
echo "📝 Useful Commands:"
echo "  View logs:           docker-compose logs -f"
echo "  View backend logs:   docker-compose logs -f backend"
echo "  Restart service:     docker-compose restart backend"
echo "  Stop all:            docker-compose down"
echo "  Django shell:        docker-compose exec backend python manage.py shell"
echo ""
echo "🔄 Rollback:"
echo "  ./rollback.sh <previous-version>"
echo ""
echo "========================================="

# Save deployment info
cat > "$APP_DIR/deployment-info.txt" <<EOF
Deployment Information
=====================
Version: $VERSION_TAG
Registry: ${REGISTRY:-Local images}
Deployed: $(date)
Deployed By: $(whoami)
Images:
  Backend: $BACKEND_IMAGE
  Frontend: $FRONTEND_IMAGE
  Nginx: $NGINX_IMAGE
EOF

echo "💾 Deployment info saved to: $APP_DIR/deployment-info.txt"
echo ""
echo "🎉 Deployment complete!"
echo "========================================="
