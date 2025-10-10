#!/bin/bash
set -e

# Build script for Sanbox Docker containers
# Usage: ./build.sh [development|production]

MODE=${1:-development}

echo "========================================="
echo "🐳 Building Sanbox Docker Images"
echo "Mode: $MODE"
echo "========================================="

if [ "$MODE" == "development" ]; then
    echo "📦 Building development images..."

    echo "  → Building backend (development)..."
    docker build \
        --target development \
        --tag sanbox-backend:dev \
        ./backend

    echo "  → Building frontend (development)..."
    docker build \
        --target development \
        --tag sanbox-frontend:dev \
        ./frontend

    echo "✅ Development images built successfully!"
    echo ""
    echo "Next steps:"
    echo "  ./dev-up.sh          # Start development environment"

elif [ "$MODE" == "production" ]; then
    echo "📦 Building production images..."

    # Get version from git or use default
    VERSION=${VERSION:-$(git describe --tags --abbrev=0 2>/dev/null || echo "1.0.0")}
    BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
    COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

    echo "  Version: $VERSION"
    echo "  Build Date: $BUILD_DATE"
    echo "  Commit: $COMMIT_HASH"
    echo ""

    echo "  → Building backend (production)..."
    docker build \
        --target production \
        --tag sanbox-backend:latest \
        --tag sanbox-backend:${VERSION} \
        --build-arg BUILD_DATE="${BUILD_DATE}" \
        --build-arg VERSION="${VERSION}" \
        --build-arg COMMIT_HASH="${COMMIT_HASH}" \
        ./backend

    echo "  → Building frontend (production)..."
    docker build \
        --target production \
        --tag sanbox-frontend:latest \
        --tag sanbox-frontend:${VERSION} \
        --build-arg REACT_APP_VERSION="${VERSION}" \
        --build-arg REACT_APP_BUILD_DATE="${BUILD_DATE}" \
        --build-arg REACT_APP_COMMIT_HASH="${COMMIT_HASH}" \
        ./frontend

    echo "  → Building nginx..."
    docker build \
        --tag sanbox-nginx:latest \
        --tag sanbox-nginx:${VERSION} \
        ./nginx

    echo "✅ Production images built successfully!"
    echo ""
    echo "Images:"
    docker images | grep sanbox
    echo ""
    echo "Next steps:"
    echo "  docker-compose up -d  # Start production environment"

else
    echo "❌ Invalid mode: $MODE"
    echo "Usage: ./build.sh [development|production]"
    exit 1
fi

echo "========================================="
