#!/bin/bash
set -e

# Container-based deployment script for Sanbox
# Maintains git-based deployment workflow with container orchestration
# Usage: ./deploy-container.sh [version-tag]
#   ./deploy-container.sh v1.2.3    # Deploy specific version
#   ./deploy-container.sh           # Deploy latest from main branch

REPO_URL="https://github.com/rickkoe/sanbox.git"  # UPDATE THIS
APP_DIR="/var/www/sanbox"
BUILD_DIR="${APP_DIR}_build"
BRANCH="main"
VERSION_TAG=$1

echo "========================================="
echo "🐳 Sanbox Container Deployment"
echo "========================================="

# Determine version to deploy
if [ ! -z "$VERSION_TAG" ]; then
    echo "📌 Deploying specific version: $VERSION_TAG"
    DEPLOY_VERSION=$VERSION_TAG
else
    echo "📌 Deploying latest from $BRANCH branch"
    DEPLOY_VERSION="latest"
fi
echo "🕐 Started at: $(date)"
echo "========================================="

# Check prerequisites
echo "🔍 Checking prerequisites..."

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    exit 1
fi
echo "✅ Docker: $(docker --version)"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed"
    exit 1
fi
echo "✅ Docker Compose: $(docker-compose --version)"

# Check if Docker daemon is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker daemon is not running"
    exit 1
fi
echo "✅ Docker daemon is running"

# Create build directory if it doesn't exist
if [ ! -d "$BUILD_DIR" ]; then
    echo ""
    echo "📁 Creating build directory..."
    mkdir -p "$BUILD_DIR"
    echo "✅ Build directory created: $BUILD_DIR"
fi

# Clone or update repository
echo ""
echo "📥 Fetching code from GitHub..."
cd "$BUILD_DIR"

if [ -d ".git" ]; then
    echo "  → Updating existing repository..."
    git fetch --all --tags
else
    echo "  → Cloning repository..."
    git clone "$REPO_URL" .
fi

# Checkout specific version or latest
if [ ! -z "$VERSION_TAG" ]; then
    echo "  → Checking out version: $VERSION_TAG"
    git checkout tags/$VERSION_TAG
else
    echo "  → Checking out latest from $BRANCH"
    git checkout $BRANCH
    git pull origin $BRANCH
fi

# Get version info
if [ ! -z "$VERSION_TAG" ]; then
    BUILD_VERSION=$VERSION_TAG
else
    BUILD_VERSION=$(git describe --tags --abbrev=0 2>/dev/null || echo "latest")
fi
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
COMMIT_HASH=$(git rev-parse --short HEAD)

echo ""
echo "📦 Build Information:"
echo "  Version: $BUILD_VERSION"
echo "  Commit: $COMMIT_HASH"
echo "  Date: $BUILD_DATE"

# Build Docker images
echo ""
echo "🏗️  Building Docker images..."

echo "  → Building backend..."
docker build \
    --target production \
    --tag sanbox-backend:${BUILD_VERSION} \
    --tag sanbox-backend:latest \
    --build-arg BUILD_DATE="${BUILD_DATE}" \
    --build-arg VERSION="${BUILD_VERSION}" \
    --build-arg COMMIT_HASH="${COMMIT_HASH}" \
    -f backend/Dockerfile \
    backend/

echo "  → Building frontend..."
docker build \
    --target production \
    --tag sanbox-frontend:${BUILD_VERSION} \
    --tag sanbox-frontend:latest \
    --build-arg REACT_APP_VERSION="${BUILD_VERSION}" \
    --build-arg REACT_APP_BUILD_DATE="${BUILD_DATE}" \
    --build-arg REACT_APP_COMMIT_HASH="${COMMIT_HASH}" \
    -f frontend/Dockerfile \
    frontend/

echo "  → Building nginx..."
docker build \
    --tag sanbox-nginx:${BUILD_VERSION} \
    --tag sanbox-nginx:latest \
    -f nginx/Dockerfile \
    nginx/

echo "✅ Images built successfully!"

# Copy deployment files to app directory
echo ""
echo "📋 Preparing deployment files..."
if [ ! -d "$APP_DIR" ]; then
    mkdir -p "$APP_DIR"
fi

# Copy docker-compose and env files
cp docker-compose.yml "$APP_DIR/"
if [ -f .env ]; then
    echo "  → Using existing .env file"
else
    if [ -f "$APP_DIR/.env" ]; then
        echo "  → .env already exists in $APP_DIR"
    else
        echo "  → Creating .env from example"
        cp .env.example "$APP_DIR/.env"
        echo "⚠️  WARNING: Please update $APP_DIR/.env with production values!"
    fi
fi

# Create directories with correct permissions for container user (UID 1001)
echo "  → Creating directories with correct permissions..."
mkdir -p "$APP_DIR/logs" "$APP_DIR/media" "$APP_DIR/static" 2>/dev/null || true
chown -R 1001:1001 "$APP_DIR/logs" "$APP_DIR/media" "$APP_DIR/static" 2>/dev/null || true
chmod -R 755 "$APP_DIR/logs" "$APP_DIR/media" "$APP_DIR/static" 2>/dev/null || true

# Navigate to app directory for deployment
cd "$APP_DIR"

# Stop existing containers gracefully
echo ""
echo "🛑 Stopping existing containers..."
if docker-compose ps -q | grep -q .; then
    echo "  → Gracefully stopping services..."
    docker-compose down --timeout 30
    echo "✅ Containers stopped"
else
    echo "  → No running containers found"
fi

# Start new containers
echo ""
echo "🚀 Starting new containers..."
docker-compose up -d

# Wait for services to be healthy
echo ""
echo "⏳ Waiting for services to start..."
sleep 10

# Check if services are running
echo ""
echo "🔍 Checking service health..."
docker-compose ps

# Wait for database to be ready
echo ""
echo "⏳ Waiting for database..."
until docker-compose exec -T postgres pg_isready -U ${POSTGRES_USER:-sanbox_user} > /dev/null 2>&1; do
    echo "  Database is starting..."
    sleep 2
done
echo "✅ Database is ready"

# Create and run database migrations
echo ""
echo "🗄️  Creating database migrations..."
docker-compose exec -T backend python manage.py makemigrations --noinput

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

# Show deployment status
echo ""
echo "========================================="
echo "✅ Deployment Completed!"
echo "========================================="
echo ""
echo "📊 Deployment Details:"
echo "  Version: $BUILD_VERSION"
echo "  Commit: $COMMIT_HASH"
echo "  Date: $BUILD_DATE"
echo ""
echo "🐳 Running Containers:"
docker-compose ps
echo ""
echo "📋 Container Images:"
docker images | grep -E "sanbox-(backend|frontend|nginx)" | head -6
echo ""
echo "🌐 Service URLs:"
echo "  Application: http://$(hostname -I | awk '{print $1}')/"
echo "  Admin:       http://$(hostname -I | awk '{print $1}')/admin/"
echo ""
echo "📝 Useful Commands:"
echo "  View logs:           cd $APP_DIR && docker-compose logs -f"
echo "  View backend logs:   cd $APP_DIR && docker-compose logs -f backend"
echo "  Restart service:     cd $APP_DIR && docker-compose restart backend"
echo "  Stop all:            cd $APP_DIR && docker-compose down"
echo "  Django shell:        cd $APP_DIR && docker-compose exec backend python manage.py shell"
echo ""
echo "🔄 Rollback:"
echo "  ./rollback.sh <previous-version>"
echo ""
echo "========================================="
echo "🎉 Deployment complete at $(date)"
echo "========================================="

# Save deployment info
cat > "$APP_DIR/deployment-info.txt" <<EOF
Deployment Information
=====================
Version: $BUILD_VERSION
Commit: $COMMIT_HASH
Build Date: $BUILD_DATE
Deployed: $(date)
Deployed By: $(whoami)
EOF

echo ""
echo "💾 Deployment info saved to: $APP_DIR/deployment-info.txt"
